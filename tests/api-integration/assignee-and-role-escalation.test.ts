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

async function seedTask(projectId: string, columnId: string) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: "Task",
      priority: "low",
      status: "to-do",
      columnId,
      number: 1,
      position: 1,
    })
    .returning();
  return task;
}

// The caller owns workspace A; the stranger only belongs to another workspace.
async function seedOwnerAndStranger() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  const task = await seedTask(project.id, columns.todo.id);
  const stranger = await createWorkspaceMember({ role: "owner" });
  return { owner, project, task, stranger };
}

describe("API integration: assignee must be a workspace member", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects PUT /task/assignee/:id for a user outside the workspace", async () => {
    const { owner, task, stranger } = await seedOwnerAndStranger();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/assignee/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: stranger.user.id }),
    });

    expect(response.status).toBe(400);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted?.userId).toBeNull();
  });

  it("still allows assigning a workspace member", async () => {
    const { owner, task } = await seedOwnerAndStranger();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/assignee/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: owner.user.id }),
    });

    expect(response.status).toBe(200);
  });

  it("rejects a bulk updateAssignee to a user outside the workspace", async () => {
    const { owner, task, stranger } = await seedOwnerAndStranger();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        taskIds: [task.id],
        operation: "updateAssignee",
        value: stranger.user.id,
      }),
    });

    expect(response.status).toBe(400);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted?.userId).toBeNull();
  });

  it("rejects creating a task assigned to a user outside the workspace", async () => {
    const { owner, project, stranger } = await seedOwnerAndStranger();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${project.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Leak",
        description: "",
        priority: "low",
        status: "to-do",
        userId: stranger.user.id,
      }),
    });

    expect(response.status).toBe(400);
  });

  it("rejects PUT /task/:id assigning a user outside the workspace", async () => {
    const { owner, project, task, stranger } = await seedOwnerAndStranger();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Task",
        description: "",
        priority: "low",
        status: "to-do",
        projectId: project.id,
        position: 1,
        userId: stranger.user.id,
      }),
    });

    expect(response.status).toBe(400);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted?.userId).toBeNull();
  });
});

describe("API integration: project role self-escalation", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  // A project member whose only role grants role:manage (plus read access).
  async function seedRoleManager() {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    await seedProjectRoles(db, project.id);

    const manager = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: owner.workspace.id,
      userId: manager.user.id,
      role: "member",
      joinedAt: new Date(),
    });

    const [role] = await db
      .insert(schema.projectRoleTable)
      .values({ projectId: project.id, name: "Role manager" })
      .returning();
    await db.insert(schema.projectRolePermissionTable).values([
      { projectRoleId: role.id, resource: "role", action: "manage" },
      { projectRoleId: role.id, resource: "item", action: "read" },
    ]);
    const [member] = await db
      .insert(schema.projectMemberTable)
      .values({ projectId: project.id, userId: manager.user.id })
      .returning();
    await db.insert(schema.projectMemberRoleTable).values({
      projectMemberId: member.id,
      projectRoleId: role.id,
    });

    return { owner, project, manager, role };
  }

  it("stops a role:manage holder from widening their own role", async () => {
    const { project, manager, role } = await seedRoleManager();
    mockAuthenticatedSession(manager.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-rbac/${project.id}/roles/${role.id}`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          permissions: {
            role: ["manage"],
            member: ["manage"],
            item: ["delete"],
          },
        }),
      },
    );

    expect(response.status).toBe(403);
    const perms = await db
      .select()
      .from(schema.projectRolePermissionTable)
      .where(eq(schema.projectRolePermissionTable.projectRoleId, role.id));
    expect(perms).toHaveLength(2);
  });

  it("stops a non-Owner from creating or deleting roles", async () => {
    const { project, manager, role } = await seedRoleManager();
    mockAuthenticatedSession(manager.user);
    const { app } = createApp();

    const created = await app.request(`/api/project-rbac/${project.id}/roles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Everything",
        permissions: { item: ["delete"] },
      }),
    });
    expect(created.status).toBe(403);

    const deleted = await app.request(
      `/api/project-rbac/${project.id}/roles/${role.id}`,
      { method: "DELETE" },
    );
    expect(deleted.status).toBe(403);
  });

  it("lets the workspace owner (implicit project Owner) manage roles", async () => {
    const { owner, project } = await seedRoleManager();
    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-rbac/${project.id}/roles`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Reviewer",
          permissions: { item: ["read"] },
        }),
      },
    );

    expect(response.status).toBe(200);
  });
});
