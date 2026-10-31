import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { seedProjectRoles } from "../../apps/api/src/project-rbac/seed-default-project-roles";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seedCompletableSprint() {
  const owner = await createWorkspaceMember({
    role: "owner",
    userName: "Sprint Owner",
  });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  await seedProjectRoles(db, project.id);
  const [sprint] = await db
    .insert(schema.sprintTable)
    .values({ projectId: project.id, name: "Sprint 1", state: "active" })
    .returning();
  const [nextSprint] = await db
    .insert(schema.sprintTable)
    .values({ projectId: project.id, name: "Sprint 2" })
    .returning();

  const base = { projectId: project.id, priority: "low", sprintId: sprint.id };
  await db.insert(schema.taskTable).values([
    {
      ...base,
      title: "Done A",
      status: "done",
      columnId: columns.done.id,
      points: 5,
      number: 1,
      position: 1,
    },
    {
      ...base,
      title: "Done B",
      status: "done",
      columnId: columns.done.id,
      points: null,
      number: 2,
      position: 2,
    },
    {
      ...base,
      title: "Todo C",
      status: "to-do",
      columnId: columns.todo.id,
      points: 3,
      number: 3,
      position: 3,
    },
    {
      ...base,
      title: "No column D",
      status: "to-do",
      columnId: null,
      points: 2,
      number: 4,
      position: 4,
    },
  ]);

  return { owner, project, sprint, nextSprint };
}

describe("API integration: sprint completion report", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stores the completion snapshot and serves it from /report", async () => {
    const { owner, sprint, nextSprint } = await seedCompletableSprint();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const completeResponse = await app.request(
      `/api/sprint/${sprint.id}/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetSprintId: nextSprint.id }),
      },
    );
    expect(completeResponse.status).toBe(200);
    const completed = (await completeResponse.json()) as Record<
      string,
      unknown
    >;
    expect(completed).toMatchObject({
      state: "completed",
      totalTasks: 4,
      completedTasks: 2,
      totalPoints: 10,
      completedPoints: 5,
    });

    const [row] = await db
      .select({
        completedAt: schema.sprintTable.completedAt,
        snapshot: schema.sprintTable.completionSnapshot,
      })
      .from(schema.sprintTable)
      .where(eq(schema.sprintTable.id, sprint.id));

    expect(row?.snapshot).toMatchObject({
      version: 1,
      completedBy: owner.user.id,
      targetSprintId: nextSprint.id,
      tasks: { total: 4, done: 2, carriedOver: 2 },
      points: { total: 10, done: 5, carriedOver: 5 },
    });
    expect(row?.snapshot?.completedAt).toBe(row?.completedAt?.toISOString());
    expect(
      row?.snapshot?.doneTasks.map(({ number, title }) => ({ number, title })),
    ).toEqual([
      { number: 1, title: "Done A" },
      { number: 2, title: "Done B" },
    ]);
    expect(
      row?.snapshot?.carriedOverTasks.map(({ number, title }) => ({
        number,
        title,
      })),
    ).toEqual([
      { number: 3, title: "Todo C" },
      { number: 4, title: "No column D" },
    ]);

    // The regular sprint endpoints leave the snapshot out.
    const sprintResponse = await app.request(`/api/sprint/${sprint.id}`);
    expect(sprintResponse.status).toBe(200);
    expect(await sprintResponse.json()).not.toHaveProperty(
      "completionSnapshot",
    );

    const reportResponse = await app.request(`/api/sprint/${sprint.id}/report`);
    expect(reportResponse.status).toBe(200);
    const report = (await reportResponse.json()) as {
      completedByName: string | null;
      snapshot: unknown;
    };
    expect(report.completedByName).toBe("Sprint Owner");
    expect(report.snapshot).toEqual(JSON.parse(JSON.stringify(row?.snapshot)));
  });

  it("returns a null snapshot for sprints completed without one", async () => {
    const { owner, sprint } = await seedCompletableSprint();
    await db
      .update(schema.sprintTable)
      .set({ state: "completed", completedAt: new Date() })
      .where(eq(schema.sprintTable.id, sprint.id));
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/sprint/${sprint.id}/report`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      state: "completed",
      snapshot: null,
    });
  });

  it("forbids the report to workspace members outside the project", async () => {
    const { owner, sprint } = await seedCompletableSprint();
    const outsider = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: outsider.user.id,
      role: "member",
      joinedAt: new Date(),
    });
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(`/api/sprint/${sprint.id}/report`);
    expect(response.status).toBe(403);
  });
});
