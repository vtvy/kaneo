import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
  joinProject,
} from "./helpers/fixtures";

type FeedWithToken = { id: string; token: string; labelNames: string[] };

async function addToWorkspace(workspaceId: string, userId: string) {
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role: "member",
    joinedAt: new Date(),
  });
}

async function seed() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const workspaceId = owner.workspace.id;
  const { project, columns } = await createProjectFixture({ workspaceId });
  const { project: otherProject, columns: otherColumns } =
    await createProjectFixture({ workspaceId, name: "Other" });

  const viewer = await createWorkspaceMember();
  await addToWorkspace(workspaceId, viewer.user.id);
  await joinProject(project.id, viewer.user.id, "Viewer");

  const outsider = await createWorkspaceMember();
  await addToWorkspace(workspaceId, outsider.user.id);

  const task = (values: {
    title: string;
    number: number;
    dueDate?: Date;
    projectId?: string;
    columnId?: string;
  }) => ({
    projectId: project.id,
    columnId: columns.todo.id,
    priority: "low",
    status: "to-do",
    position: values.number,
    ...values,
  });

  const [released, plain] = await db
    .insert(schema.taskTable)
    .values([
      task({
        title: "Ship release, v2; final",
        number: 1,
        dueDate: new Date("2026-11-10T00:00:00Z"),
      }),
      task({
        title: "Plain dated task",
        number: 2,
        dueDate: new Date("2026-11-12T00:00:00Z"),
      }),
      task({ title: "Unscheduled task", number: 3 }),
      task({
        title: "Other project task",
        number: 1,
        dueDate: new Date("2026-11-11T00:00:00Z"),
        projectId: otherProject.id,
        columnId: otherColumns.todo.id,
      }),
    ])
    .returning();

  await db.insert(schema.labelTable).values([
    { name: "Release", color: "#ff0000", taskId: released.id, workspaceId },
    { name: "Ops", color: "#00ff00", taskId: plain.id, workspaceId },
  ]);

  return { owner, viewer, outsider, project, released, plain };
}

async function createFeed(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
  body: Record<string, unknown> = {},
) {
  return app.request(`/api/calendar-feed/project/${projectId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function fetchFeed(
  app: ReturnType<typeof createApp>["app"],
  token: string,
) {
  return app.request(`/api/calendar-feed/${token}/calendar.ics`);
}

describe("API integration: calendar feeds", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("serves an iCal feed with only the project's scheduled tasks", async () => {
    const { viewer, project } = await seed();
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();

    const created = await createFeed(app, project.id, {
      timeZone: "Asia/Ho_Chi_Minh",
    });
    expect(created.status).toBe(200);
    const feed = (await created.json()) as FeedWithToken;
    expect(feed.token).toMatch(/^[a-f0-9]{64}$/);

    const [stored] = await db
      .select()
      .from(schema.calendarFeedTable)
      .where(eq(schema.calendarFeedTable.id, feed.id));
    expect(stored.userId).toBe(viewer.user.id);
    expect(stored.tokenHash).not.toBe(feed.token);
    expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    const response = await fetchFeed(app, feed.token);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/calendar");
    expect(response.headers.get("cache-control")).toContain("no-store");
    const body = await response.text();
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body).toContain("SUMMARY:Ship release\\, v2\\; final");
    expect(body).toContain("SUMMARY:Plain dated task");
    expect(body).not.toContain("Unscheduled task");
    expect(body).not.toContain("Other project task");
    expect(body).not.toContain("DESCRIPTION");
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  });

  it("never lists the secret and only shows the caller's own feeds", async () => {
    const { owner, viewer, project } = await seed();
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();
    await createFeed(app, project.id);

    const listed = await app.request(
      `/api/calendar-feed/project/${project.id}`,
    );
    expect(listed.status).toBe(200);
    const feeds = (await listed.json()) as Record<string, unknown>[];
    expect(feeds).toHaveLength(1);
    expect(feeds[0]).not.toHaveProperty("token");
    expect(feeds[0]).not.toHaveProperty("tokenHash");

    mockAuthenticatedSession(owner.user);
    const ownerList = await app.request(
      `/api/calendar-feed/project/${project.id}`,
    );
    expect(await ownerList.json()).toEqual([]);

    // Others cannot revoke someone else's feed.
    const revoke = await app.request(
      `/api/calendar-feed/project/${project.id}/${feeds[0].id}`,
      { method: "DELETE" },
    );
    expect(revoke.status).toBe(404);
  });

  it("filters by label", async () => {
    const { viewer, project } = await seed();
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();

    const feed = (await (
      await createFeed(app, project.id, { labelNames: ["Release"] })
    ).json()) as FeedWithToken;
    expect(feed.labelNames).toEqual(["Release"]);

    const body = await (await fetchFeed(app, feed.token)).text();
    expect(body).toContain("Ship release");
    expect(body).not.toContain("Plain dated task");

    const unknown = await createFeed(app, project.id, {
      labelNames: ["Nope"],
    });
    expect(unknown.status).toBe(400);
  });

  it("requires item:read in the project to create a feed", async () => {
    const { outsider, project } = await seed();
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await createFeed(app, project.id);
    expect(response.status).toBe(403);
  });

  it("returns 404 for revoked, rotated and unknown tokens", async () => {
    const { viewer, project } = await seed();
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();

    const feed = (await (
      await createFeed(app, project.id)
    ).json()) as FeedWithToken;

    const rotated = await app.request(
      `/api/calendar-feed/project/${project.id}/${feed.id}/regenerate`,
      { method: "POST" },
    );
    expect(rotated.status).toBe(200);
    const next = (await rotated.json()) as FeedWithToken;
    expect(next.token).not.toBe(feed.token);
    expect((await fetchFeed(app, feed.token)).status).toBe(404);
    expect((await fetchFeed(app, next.token)).status).toBe(200);

    const revoked = await app.request(
      `/api/calendar-feed/project/${project.id}/${feed.id}`,
      { method: "DELETE" },
    );
    expect(revoked.status).toBe(200);
    expect((await fetchFeed(app, next.token)).status).toBe(404);

    expect((await fetchFeed(app, "a".repeat(64))).status).toBe(404);
    expect((await fetchFeed(app, "not-a-token")).status).toBe(400);
  });

  it("stops serving tasks once the owner loses project access", async () => {
    const { viewer, project, owner } = await seed();
    mockAuthenticatedSession(viewer.user);
    const { app } = createApp();

    const feed = (await (
      await createFeed(app, project.id)
    ).json()) as FeedWithToken;
    expect((await fetchFeed(app, feed.token)).status).toBe(200);

    await db
      .delete(schema.projectMemberTable)
      .where(
        and(
          eq(schema.projectMemberTable.projectId, project.id),
          eq(schema.projectMemberTable.userId, viewer.user.id),
        ),
      );
    const removed = await fetchFeed(app, feed.token);
    expect(removed.status).toBe(404);
    expect(await removed.text()).not.toContain("Ship release");

    // Removing someone from the workspace also cuts off their feeds, even if
    // a stale project membership remains.
    await joinProject(project.id, viewer.user.id, "Viewer");
    expect((await fetchFeed(app, feed.token)).status).toBe(200);
    await db
      .delete(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, owner.workspace.id),
          eq(schema.workspaceUserTable.userId, viewer.user.id),
        ),
      );
    expect((await fetchFeed(app, feed.token)).status).toBe(404);
  });
});
