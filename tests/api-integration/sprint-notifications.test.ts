import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { checkSprintLifecycle } from "../../apps/api/src/sprint/sprint-notifications";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
  joinProject,
} from "./helpers/fixtures";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function addUserToWorkspace(workspaceId: string, name: string) {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({ id, email: `${id}@example.com`, emailVerified: true, name })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: id,
    role: "member",
    joinedAt: new Date(),
  });
  return user;
}

async function seed() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: owner.workspace.id,
    slug: "sprn",
  });
  const alice = await addUserToWorkspace(owner.workspace.id, "Alice");
  const bob = await addUserToWorkspace(owner.workspace.id, "Bob");
  const outsider = await addUserToWorkspace(owner.workspace.id, "Outsider");
  await joinProject(project.id, alice.id);
  await joinProject(project.id, bob.id);
  return { owner, project, alice, bob, outsider };
}

// Recipient user ids (sorted, duplicates kept) of a sprint's notifications.
async function sprintNotifications(type: string, sprintId: string) {
  const rows = await db
    .select({ userId: schema.notificationTable.userId })
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.type, type),
        sql`${schema.notificationTable.eventData}->>'sprintId' = ${sprintId}`,
      ),
    );
  return rows.map((row) => row.userId).sort();
}

describe("API integration: sprint start/end notifications", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("notifies only project members once when a sprint starts and ends", async () => {
    const { project, alice, bob } = await seed();
    const now = new Date();

    const [started] = await db
      .insert(schema.sprintTable)
      .values({
        projectId: project.id,
        name: "Sprint 1",
        startDate: new Date(now.getTime() - HOUR),
        endDate: new Date(now.getTime() + 7 * DAY),
      })
      .returning();
    const [ended] = await db
      .insert(schema.sprintTable)
      .values({
        projectId: project.id,
        name: "Sprint 0",
        startDate: new Date(now.getTime() - 14 * DAY),
        endDate: new Date(now.getTime() - HOUR),
      })
      .returning();
    const [stale] = await db
      .insert(schema.sprintTable)
      .values({
        projectId: project.id,
        name: "Old",
        startDate: new Date(now.getTime() - 3 * DAY),
        endDate: new Date(now.getTime() + DAY),
      })
      .returning();

    await checkSprintLifecycle(now);
    await checkSprintLifecycle(now);

    const members = [alice.id, bob.id].sort();
    expect(await sprintNotifications("sprint_started", started.id)).toEqual(
      members,
    );
    expect(await sprintNotifications("sprint_ended", ended.id)).toEqual(
      members,
    );
    // Outside the lookback window: no backfill for historical sprints.
    expect(await sprintNotifications("sprint_started", stale.id)).toEqual([]);
    // Ended sprint's start is long past; the started sprint has not ended.
    expect(await sprintNotifications("sprint_started", ended.id)).toEqual([]);
    expect(await sprintNotifications("sprint_ended", started.id)).toEqual([]);
  });

  it("notifies members except the completer when a sprint is completed, without duplicates", async () => {
    const { owner, project, alice, bob } = await seed();
    await joinProject(project.id, owner.user.id, "Owner");
    const now = new Date();

    const [sprint] = await db
      .insert(schema.sprintTable)
      .values({
        projectId: project.id,
        name: "Sprint 2",
        startDate: new Date(now.getTime() - 2 * DAY),
        endDate: new Date(now.getTime() - HOUR),
      })
      .returning();

    // Date-driven end fires first for every member...
    await checkSprintLifecycle(now);
    expect(await sprintNotifications("sprint_ended", sprint.id)).toEqual(
      [alice.id, bob.id, owner.user.id].sort(),
    );

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const response = await app.request(`/api/sprint/${sprint.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(200);

    // ...so completing it afterwards must not notify anyone a second time.
    await new Promise((resolve) => setTimeout(resolve, 100));
    await checkSprintLifecycle(now);
    expect(await sprintNotifications("sprint_ended", sprint.id)).toEqual(
      [alice.id, bob.id, owner.user.id].sort(),
    );
  });

  it("completion before the end date notifies other members once", async () => {
    const { owner, project, alice, bob, outsider } = await seed();
    const now = new Date();
    const [sprint] = await db
      .insert(schema.sprintTable)
      .values({
        projectId: project.id,
        name: "Sprint 3",
        startDate: new Date(now.getTime() - 2 * DAY),
        endDate: new Date(now.getTime() + 5 * DAY),
      })
      .returning();

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();
    const response = await app.request(`/api/sprint/${sprint.id}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(200);

    await vi.waitFor(async () => {
      expect(await sprintNotifications("sprint_ended", sprint.id)).toEqual(
        [alice.id, bob.id].sort(),
      );
    });
    // Completed sprints are skipped by the scheduler even once the date passes.
    await checkSprintLifecycle(new Date(now.getTime() + 5 * DAY + HOUR));
    const recipients = await sprintNotifications("sprint_ended", sprint.id);
    expect(recipients).toEqual([alice.id, bob.id].sort());
    expect(recipients).not.toContain(outsider.id);
    expect(recipients).not.toContain(owner.user.id);
  });
});
