import { and, eq, isNull } from "drizzle-orm";
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

async function addToWorkspace(
  workspaceId: string,
  userId: string,
  role = "member",
) {
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role,
    joinedAt: new Date(),
  });
}

/**
 * Source workspace with a project owned by `owner`; a target workspace where
 * `owner` and `shared` are members but `leaver` is not.
 */
async function seedMove() {
  const owner = await createWorkspaceMember({ role: "member" });
  const source = owner.workspace;
  const target = (await createWorkspaceMember({ role: "owner" })).workspace;
  await addToWorkspace(target.id, owner.user.id, "member");

  const shared = await createWorkspaceMember();
  await addToWorkspace(source.id, shared.user.id);
  await addToWorkspace(target.id, shared.user.id);

  const leaver = await createWorkspaceMember();
  await addToWorkspace(source.id, leaver.user.id);

  const { project, columns } = await createProjectFixture({
    workspaceId: source.id,
    slug: "MOV",
  });
  await joinProject(project.id, owner.user.id, "Owner");
  await joinProject(project.id, shared.user.id, "Member");
  await joinProject(project.id, leaver.user.id, "Member");

  const [leaverTask, sharedTask] = await db
    .insert(schema.taskTable)
    .values([
      {
        projectId: project.id,
        title: "Leaver task",
        columnId: columns.todo.id,
        number: 1,
        userId: leaver.user.id,
        reporterId: leaver.user.id,
      },
      {
        projectId: project.id,
        title: "Shared task",
        columnId: columns.todo.id,
        number: 2,
        userId: shared.user.id,
        reporterId: shared.user.id,
      },
    ])
    .returning();

  await db.insert(schema.taskInvolvementTable).values([
    { taskId: leaverTask.id, userId: leaver.user.id, reason: "assignee" },
    { taskId: sharedTask.id, userId: shared.user.id, reason: "assignee" },
  ]);

  await db.insert(schema.labelTable).values([
    { name: "bug", color: "#ff0000", workspaceId: source.id },
    {
      name: "bug",
      color: "#ff0000",
      workspaceId: source.id,
      taskId: sharedTask.id,
    },
    {
      name: "ux",
      color: "#00ff00",
      workspaceId: source.id,
      taskId: sharedTask.id,
    },
    // The target already knows "bug", in its own color.
    { name: "bug", color: "#0000ff", workspaceId: target.id },
  ]);

  const [asset] = await db
    .insert(schema.assetTable)
    .values({
      workspaceId: source.id,
      projectId: project.id,
      taskId: sharedTask.id,
      objectKey: `workspace/${source.id}/project/${project.id}/task/${sharedTask.id}/descriptions/a.png`,
      filename: "a.png",
      mimeType: "image/png",
      size: 10,
    })
    .returning();

  const [integration] = await db
    .insert(schema.integrationTable)
    .values({ projectId: project.id, type: "gitea", config: "{}" })
    .returning();

  return {
    owner,
    shared,
    leaver,
    source,
    target,
    project,
    leaverTask,
    sharedTask,
    asset,
    integration,
  };
}

function move(projectId: string, workspaceId: string) {
  const { app } = createApp();
  return app.request(`/api/project/${projectId}/move`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ workspaceId }),
  });
}

describe("API integration: move project to another workspace", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("refuses project members who can't manage the project", async () => {
    const { shared, project, target, source } = await seedMove();
    mockAuthenticatedSession(shared.user);

    const response = await move(project.id, target.id);

    expect(response.status).toBe(403);
    const [row] = await db
      .select({ workspaceId: schema.projectTable.workspaceId })
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(row?.workspaceId).toBe(source.id);
  });

  it("refuses a target workspace the caller doesn't belong to", async () => {
    const { owner, project } = await seedMove();
    const elsewhere = (await createWorkspaceMember({ role: "owner" }))
      .workspace;
    mockAuthenticatedSession(owner.user);

    const response = await move(project.id, elsewhere.id);

    expect(response.status).toBe(403);
  });

  it("refuses a target where the caller can't create projects", async () => {
    const { owner, project, target } = await seedMove();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "viewer" })
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, target.id),
          eq(schema.workspaceUserTable.userId, owner.user.id),
        ),
      );
    mockAuthenticatedSession(owner.user);

    const response = await move(project.id, target.id);

    expect(response.status).toBe(403);
  });

  it("refuses when the target already uses the project key", async () => {
    const { owner, project, target } = await seedMove();
    await createProjectFixture({ workspaceId: target.id, slug: "mov" });
    mockAuthenticatedSession(owner.user);

    const response = await move(project.id, target.id);

    expect(response.status).toBe(409);
  });

  it("moves the project and reconciles people, labels, assets and integrations", async () => {
    const s = await seedMove();
    mockAuthenticatedSession(s.owner.user);

    const response = await move(s.project.id, s.target.id);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      workspaceId: string;
      unassignedTaskCount: number;
      removedMemberCount: number;
      deactivatedIntegrationCount: number;
    };
    expect(body).toMatchObject({
      workspaceId: s.target.id,
      unassignedTaskCount: 1,
      removedMemberCount: 1,
      deactivatedIntegrationCount: 1,
    });

    const members = await db
      .select({ userId: schema.projectMemberTable.userId })
      .from(schema.projectMemberTable)
      .where(eq(schema.projectMemberTable.projectId, s.project.id));
    expect(members.map((m) => m.userId).sort()).toEqual(
      [s.owner.user.id, s.shared.user.id].sort(),
    );

    const tasks = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.projectId, s.project.id));
    const leaverTask = tasks.find((t) => t.id === s.leaverTask.id);
    const sharedTask = tasks.find((t) => t.id === s.sharedTask.id);
    expect(tasks).toHaveLength(2);
    expect(leaverTask?.userId).toBeNull();
    expect(leaverTask?.reporterId).toBeNull();
    expect(sharedTask?.userId).toBe(s.shared.user.id);
    expect(sharedTask?.reporterId).toBe(s.shared.user.id);

    const unassigned = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, s.leaverTask.id),
          eq(schema.activityTable.type, "unassigned"),
        ),
      );
    expect(unassigned).toHaveLength(1);

    const involvement = await db
      .select({ userId: schema.taskInvolvementTable.userId })
      .from(schema.taskInvolvementTable);
    expect(involvement.map((i) => i.userId)).toEqual([s.shared.user.id]);

    const taskLabels = await db
      .select()
      .from(schema.labelTable)
      .where(eq(schema.labelTable.taskId, s.sharedTask.id));
    expect(taskLabels.every((l) => l.workspaceId === s.target.id)).toBe(true);
    expect(taskLabels.find((l) => l.name === "bug")?.color).toBe("#0000ff");

    const targetLabels = await db
      .select({ name: schema.labelTable.name })
      .from(schema.labelTable)
      .where(
        and(
          eq(schema.labelTable.workspaceId, s.target.id),
          isNull(schema.labelTable.taskId),
        ),
      );
    expect(targetLabels.map((l) => l.name).sort()).toEqual(["bug", "ux"]);

    const [asset] = await db
      .select()
      .from(schema.assetTable)
      .where(eq(schema.assetTable.id, s.asset.id));
    expect(asset?.workspaceId).toBe(s.target.id);
    expect(asset?.objectKey).toBe(s.asset.objectKey);

    const [integration] = await db
      .select({ isActive: schema.integrationTable.isActive })
      .from(schema.integrationTable)
      .where(eq(schema.integrationTable.id, s.integration.id));
    expect(integration?.isActive).toBe(false);
  });

  it("cuts off source-only members and admits the mover in the target", async () => {
    const s = await seedMove();
    mockAuthenticatedSession(s.owner.user);
    expect((await move(s.project.id, s.target.id)).status).toBe(200);

    mockAuthenticatedSession(s.leaver.user);
    const { app } = createApp();
    const leaverProject = await app.request(`/api/project/${s.project.id}`);
    expect(leaverProject.status).toBe(403);
    const leaverTask = await app.request(`/api/task/${s.sharedTask.id}`);
    expect(leaverTask.status).toBe(403);

    mockAuthenticatedSession(s.owner.user);
    const ownerProject = await createApp().app.request(
      `/api/project/${s.project.id}`,
    );
    expect(ownerProject.status).toBe(200);

    mockAuthenticatedSession(s.shared.user);
    const sharedTask = await createApp().app.request(
      `/api/task/${s.sharedTask.id}`,
    );
    expect(sharedTask.status).toBe(200);
  });

  it("lets a source workspace admin without project membership move it", async () => {
    const s = await seedMove();
    const admin = await createWorkspaceMember();
    await addToWorkspace(s.source.id, admin.user.id, "admin");
    await addToWorkspace(s.target.id, admin.user.id, "member");
    mockAuthenticatedSession(admin.user);

    expect((await move(s.project.id, s.target.id)).status).toBe(200);

    const [membership] = await db
      .select()
      .from(schema.projectMemberTable)
      .where(
        and(
          eq(schema.projectMemberTable.projectId, s.project.id),
          eq(schema.projectMemberTable.userId, admin.user.id),
        ),
      );
    expect(membership).toBeDefined();
  });
});
