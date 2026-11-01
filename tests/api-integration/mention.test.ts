import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  addProjectMemberWithRole,
  seedProjectRoles,
} from "../../apps/api/src/project-rbac/seed-default-project-roles";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

function mention(id: string, label: string) {
  return `<kaneo-mention id="${id}" label="${label}"></kaneo-mention>`;
}

async function joinWorkspace(workspaceId: string, userId: string) {
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role: "member",
    joinedAt: new Date(),
  });
}

async function seedMentionScenario() {
  const author = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: author.workspace.id,
  });
  await seedProjectRoles(db, project.id);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Mention target task",
      priority: "low",
      status: "to-do",
      columnId: columns.todo.id,
      number: 1,
      position: 1,
    })
    .returning();

  // Workspace member with read access to the project.
  const viewer = await createWorkspaceMember({ userName: "Project Viewer" });
  await joinWorkspace(author.workspace.id, viewer.user.id);
  await addProjectMemberWithRole(db, project.id, viewer.user.id, "Viewer");

  // Workspace member who was never added to the project.
  const outsider = await createWorkspaceMember({ userName: "Outsider" });
  await joinWorkspace(author.workspace.id, outsider.user.id);

  // Registered user who is not in the task's workspace at all.
  const stranger = await createWorkspaceMember({ userName: "Stranger" });

  return { author, task, viewer, outsider, stranger };
}

/** Notifications are created by an async event subscriber; poll briefly. */
async function mentionNotificationsFor(userId: string, waitForOne = false) {
  const deadline = Date.now() + 2000;
  for (;;) {
    const rows = await db
      .select()
      .from(schema.notificationTable)
      .where(
        and(
          eq(schema.notificationTable.userId, userId),
          eq(schema.notificationTable.type, "mention"),
        ),
      );
    if (!waitForOne || rows.length > 0 || Date.now() > deadline) return rows;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe("API integration: comment @mentions", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("notifies only mentioned users who can read the project", async () => {
    const { author, task, viewer, outsider, stranger } =
      await seedMentionScenario();
    mockAuthenticatedSession(author.user);
    const { app } = createApp();

    const comment = [
      `Hi ${mention(viewer.user.id, "Project Viewer")}`,
      mention(outsider.user.id, "Outsider"),
      mention(stranger.user.id, "Stranger"),
      mention(author.user.id, "Me"),
      `\`${mention(outsider.user.id, "In code")}\``,
    ].join(" ");

    const response = await app.request("/api/activity/comment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        comment,
        // Legacy client-supplied ids are ignored by the server.
        mentions: [outsider.user.id, stranger.user.id],
      }),
    });
    expect(response.status).toBe(200);

    const viewerRows = await mentionNotificationsFor(viewer.user.id, true);
    expect(viewerRows).toHaveLength(1);
    expect(viewerRows[0]?.resourceId).toBe(task.id);
    expect(viewerRows[0]?.resourceType).toBe("task");
    expect(viewerRows[0]?.eventData).toMatchObject({
      taskTitle: "Mention target task",
      actorName: author.user.name,
    });

    // Give any (incorrect) remaining notifications time to land.
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await mentionNotificationsFor(outsider.user.id)).toHaveLength(0);
    expect(await mentionNotificationsFor(stranger.user.id)).toHaveLength(0);
    expect(await mentionNotificationsFor(author.user.id)).toHaveLength(0);
  });

  it("notifies only newly mentioned users when a comment is edited", async () => {
    const { author, task, viewer, outsider } = await seedMentionScenario();
    const second = await createWorkspaceMember({ userName: "Second Viewer" });
    await joinWorkspace(author.workspace.id, second.user.id);
    await addProjectMemberWithRole(
      db,
      task.projectId,
      second.user.id,
      "Viewer",
    );
    mockAuthenticatedSession(author.user);
    const { app } = createApp();

    const created = await app.request("/api/activity/comment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskId: task.id,
        comment: `Hi ${mention(viewer.user.id, "Project Viewer")}`,
      }),
    });
    expect(created.status).toBe(200);
    const { id: activityId } = (await created.json()) as { id: string };
    expect(await mentionNotificationsFor(viewer.user.id, true)).toHaveLength(1);

    const updated = await app.request("/api/activity/comment", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        activityId,
        comment: [
          `Hi ${mention(viewer.user.id, "Project Viewer")}`,
          mention(second.user.id, "Second Viewer"),
          mention(outsider.user.id, "Outsider"),
        ].join(" "),
      }),
    });
    expect(updated.status).toBe(200);

    expect(await mentionNotificationsFor(second.user.id, true)).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await mentionNotificationsFor(viewer.user.id)).toHaveLength(1);
    expect(await mentionNotificationsFor(outsider.user.id)).toHaveLength(0);
  });
});
