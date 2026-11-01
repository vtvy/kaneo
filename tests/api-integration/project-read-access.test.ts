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

async function seedPrivateProjectWithOutsider() {
  const owner = await createWorkspaceMember({ role: "owner" });
  const { project, columns } = await createProjectFixture({
    workspaceId: owner.workspace.id,
  });
  await seedProjectRoles(db, project.id);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Private task",
      priority: "low",
      status: "to-do",
      columnId: columns.todo.id,
      number: 1,
      position: 1,
    })
    .returning();

  // In the workspace, but never added to the project.
  const outsider = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: owner.workspace.id,
    userId: outsider.user.id,
    role: "member",
    joinedAt: new Date(),
  });

  return { owner, project, task, outsider };
}

describe("API integration: project read access", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("hides private project content from workspace members outside the project", async () => {
    const { project, task, outsider } = await seedPrivateProjectWithOutsider();
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    for (const path of [
      `/api/task/${task.id}`,
      `/api/task/all/${project.id}`,
      `/api/task/export/${project.id}`,
      `/api/comment/${task.id}`,
      `/api/activity/${task.id}`,
      `/api/task-relation/${task.id}`,
      `/api/project-rbac/${project.id}/members`,
    ]) {
      const response = await app.request(path);
      expect(response.status, path).toBe(403);
    }
  });

  it("lets project members read the same content", async () => {
    const { project, task, outsider } = await seedPrivateProjectWithOutsider();
    await addProjectMemberWithRole(db, project.id, outsider.user.id, "Viewer");
    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`);
    expect(response.status).toBe(200);
  });

  it("only lets an Owner grant the Owner role", async () => {
    const { project, outsider } = await seedPrivateProjectWithOutsider();

    // A custom role that may manage members but is not Owner.
    const [managerRole] = await db
      .insert(schema.projectRoleTable)
      .values({ projectId: project.id, name: "Member manager" })
      .returning();
    await db.insert(schema.projectRolePermissionTable).values({
      projectRoleId: managerRole.id,
      resource: "member",
      action: "manage",
    });
    const [member] = await db
      .insert(schema.projectMemberTable)
      .values({ projectId: project.id, userId: outsider.user.id })
      .returning();
    await db.insert(schema.projectMemberRoleTable).values({
      projectMemberId: member.id,
      projectRoleId: managerRole.id,
    });
    const [ownerRole] = await db
      .select({ id: schema.projectRoleTable.id })
      .from(schema.projectRoleTable)
      .where(
        and(
          eq(schema.projectRoleTable.projectId, project.id),
          eq(schema.projectRoleTable.name, "Owner"),
        ),
      );

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-rbac/${project.id}/members/${member.id}/roles`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleIds: [ownerRole.id] }),
      },
    );

    expect(response.status).toBe(403);
  });
});

describe("API integration: request body limits", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("rejects oversized JSON bodies before they reach a route", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(11 * 1024 * 1024) }),
    });

    expect(response.status).toBe(413);
  });
});
