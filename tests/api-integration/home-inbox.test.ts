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

type Columns = Awaited<ReturnType<typeof createProjectFixture>>["columns"];

async function insertTask(
  projectId: string,
  columns: Columns,
  values: {
    title: string;
    number: number;
    userId?: string;
    done?: boolean;
    dueDate?: Date;
  },
) {
  const column = values.done ? columns.done : columns.todo;
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: values.title,
      number: values.number,
      priority: "medium",
      status: column.slug,
      columnId: column.id,
      position: values.number,
      userId: values.userId ?? null,
      dueDate: values.dueDate ?? null,
    })
    .returning();
  return task;
}

// A member of "visible" who is still the assignee of a task in "hidden"
// (e.g. assigned before being removed from that project).
async function seedWorkspace() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const workspaceId = owner.workspace.id;

  const member = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: member.user.id,
    role: "member",
    joinedAt: new Date(),
  });

  const visible = await createProjectFixture({
    workspaceId,
    name: "Visible",
    slug: "VIS",
  });
  const hidden = await createProjectFixture({
    workspaceId,
    name: "Hidden",
    slug: "HID",
  });
  await joinProject(visible.project.id, member.user.id, "Viewer");
  await joinProject(hidden.project.id, owner.user.id, "Owner");

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const visibleOpen = await insertTask(visible.project.id, visible.columns, {
    title: "Visible open",
    number: 1,
    userId: member.user.id,
    dueDate: tomorrow,
  });
  const visibleDone = await insertTask(visible.project.id, visible.columns, {
    title: "Visible done",
    number: 2,
    userId: member.user.id,
    done: true,
  });
  const hiddenOpen = await insertTask(hidden.project.id, hidden.columns, {
    title: "Hidden open",
    number: 1,
    userId: member.user.id,
    dueDate: tomorrow,
  });

  await db.insert(schema.taskInvolvementTable).values([
    { taskId: visibleOpen.id, userId: member.user.id, reason: "assignee" },
    { taskId: hiddenOpen.id, userId: member.user.id, reason: "assignee" },
  ]);

  await db.insert(schema.activityTable).values([
    {
      taskId: visibleOpen.id,
      type: "comment",
      userId: owner.user.id,
      content: "Visible comment",
    },
    {
      taskId: hiddenOpen.id,
      type: "comment",
      userId: owner.user.id,
      content: "Hidden secret comment",
    },
  ]);

  return {
    owner,
    member,
    workspaceId,
    visibleOpen,
    visibleDone,
    hiddenOpen,
  };
}

describe("API integration: home up next and activity", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("never lists tasks from a project the caller is not a member of", async () => {
    const { member, workspaceId, visibleOpen, visibleDone } =
      await seedWorkspace();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    for (const scope of ["assigned", "involved"]) {
      const all = await app.request(
        `/api/task/my/${workspaceId}?scope=${scope}`,
      );
      expect(all.status).toBe(200);
      const allTasks = (await all.json()) as { projectSlug: string }[];
      expect(allTasks.length, scope).toBeGreaterThan(0);
      expect(allTasks.every((task) => task.projectSlug === "VIS")).toBe(true);
    }

    const upNext = await app.request(
      `/api/task/my/${workspaceId}?scope=assigned&open=true`,
    );
    expect(upNext.status).toBe(200);
    const ids = ((await upNext.json()) as { id: string }[]).map(
      (task) => task.id,
    );
    expect(ids).toEqual([visibleOpen.id]);
    expect(ids).not.toContain(visibleDone.id);
  });

  it("never shows activity from a project the caller is not a member of", async () => {
    const { member, workspaceId, visibleOpen } = await seedWorkspace();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/activity/workspace/${workspaceId}`,
    );
    expect(response.status).toBe(200);
    const activities = (await response.json()) as {
      taskId: string;
      excerpt: string | null;
    }[];
    expect(activities.map((activity) => activity.taskId)).toEqual([
      visibleOpen.id,
    ]);
    expect(JSON.stringify(activities)).not.toContain("Hidden secret");
  });

  it("lets a workspace owner see activity and tasks across all projects", async () => {
    const { owner, workspaceId } = await seedWorkspace();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/activity/workspace/${workspaceId}`,
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as unknown[]).length).toBe(2);
  });

  it("rejects callers outside the workspace", async () => {
    const { workspaceId } = await seedWorkspace();
    const stranger = await createWorkspaceMember();
    mockAuthenticatedSession(stranger.user);
    const { app } = createApp();

    for (const path of [
      `/api/activity/workspace/${workspaceId}`,
      `/api/task/my/${workspaceId}?open=true`,
    ]) {
      const response = await app.request(path);
      expect(response.status, path).toBe(403);
    }
  });
});

describe("API integration: inbox notifications", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function insertNotification(userId: string, isRead: boolean) {
    const [row] = await db
      .insert(schema.notificationTable)
      .values({ userId, isRead, type: "info" })
      .returning();
    return row;
  }

  it("changes, deletes and clears only the caller's own notifications", async () => {
    const me = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    const read = await insertNotification(me.user.id, true);
    const unread = await insertNotification(me.user.id, false);
    const foreign = await insertNotification(other.user.id, true);

    mockAuthenticatedSession(me.user);
    const { app } = createApp();

    const markUnread = await app.request(
      `/api/notification/${read.id}/unread`,
      { method: "PATCH" },
    );
    expect(markUnread.status).toBe(200);
    expect(((await markUnread.json()) as { isRead: boolean }).isRead).toBe(
      false,
    );

    for (const [path, method] of [
      [`/api/notification/${foreign.id}/unread`, "PATCH"],
      [`/api/notification/${foreign.id}/read`, "PATCH"],
      [`/api/notification/${foreign.id}`, "DELETE"],
    ] as const) {
      const response = await app.request(path, { method });
      expect(response.status, `${method} ${path}`).toBe(404);
    }

    await app.request(`/api/notification/${read.id}/read`, {
      method: "PATCH",
    });
    const clearRead = await app.request("/api/notification/clear-read", {
      method: "DELETE",
    });
    expect(clearRead.status).toBe(200);

    let remaining = await db.select().from(schema.notificationTable);
    expect(remaining.map((row) => row.id).sort()).toEqual(
      [unread.id, foreign.id].sort(),
    );
    expect(remaining.find((row) => row.id === foreign.id)?.isRead).toBe(true);

    const deleted = await app.request(`/api/notification/${unread.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    remaining = await db.select().from(schema.notificationTable);
    expect(remaining.map((row) => row.id)).toEqual([foreign.id]);
  });
});
