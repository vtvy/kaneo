import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { findAllIntegrationsByGiteaRepo } from "../../apps/api/src/plugins/gitea/services/integration-lookup";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function seedTask(projectId: string, columnId: string, number = 1) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId,
      title: `Task ${number}`,
      priority: "low",
      status: "to-do",
      columnId,
      number,
      position: number,
    })
    .returning();
  return task;
}

async function addWorkspaceUser(
  workspaceId: string,
  userId: string,
  role: string,
) {
  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId,
    role,
    joinedAt: new Date(),
  });
}

describe("API integration: task access", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("refuses to move a task to another project through PUT /task/:id", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const victim = await createWorkspaceMember({ role: "owner" });
    const { project: victimProject } = await createProjectFixture({
      workspaceId: victim.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);

    mockAuthenticatedSession(owner.user);
    const { app } = createApp();

    const response = await app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Planted",
        description: "",
        priority: "low",
        status: "to-do",
        projectId: victimProject.id,
        position: 0,
      }),
    });

    expect(response.status).toBe(400);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted?.projectId).toBe(project.id);
  });

  it("blocks bulk deletes in projects the caller was not added to", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const task = await seedTask(project.id, columns.todo.id);

    const outsider = await createWorkspaceMember();
    await addWorkspaceUser(owner.workspace.id, outsider.user.id, "member");

    mockAuthenticatedSession(outsider.user);
    const { app } = createApp();

    const response = await app.request("/api/task/bulk", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskIds: [task.id], operation: "delete" }),
    });

    expect(response.status).toBe(403);
    const persisted = await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, task.id),
    });
    expect(persisted).toBeDefined();
  });

  it("refuses to relate a task to one in another workspace", async () => {
    const attacker = await createWorkspaceMember({ role: "owner" });
    const { project, columns } = await createProjectFixture({
      workspaceId: attacker.workspace.id,
    });
    const ownTask = await seedTask(project.id, columns.todo.id);

    const victim = await createWorkspaceMember({ role: "owner" });
    const { project: victimProject, columns: victimColumns } =
      await createProjectFixture({ workspaceId: victim.workspace.id });
    const victimTask = await seedTask(victimProject.id, victimColumns.todo.id);

    mockAuthenticatedSession(attacker.user);
    const { app } = createApp();

    const response = await app.request("/api/task-relation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sourceTaskId: ownTask.id,
        targetTaskId: victimTask.id,
        relationType: "related",
      }),
    });

    expect(response.status).toBe(404);
  });
});

describe("API integration: Gitea integration isolation", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seedGiteaIntegration(projectId: string, secret: string) {
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId,
        type: "gitea",
        config: JSON.stringify({
          baseUrl: "https://gitea.example.com",
          accessToken: "token",
          repositoryOwner: "acme",
          repositoryName: "app",
          webhookSecret: secret,
        }),
        isActive: true,
      })
      .returning();
    return integration;
  }

  it("only matches the integration whose secret signed the webhook", async () => {
    const a = await createWorkspaceMember({ role: "owner" });
    const b = await createWorkspaceMember({ role: "owner" });
    const { project: projectA } = await createProjectFixture({
      workspaceId: a.workspace.id,
    });
    const { project: projectB } = await createProjectFixture({
      workspaceId: b.workspace.id,
    });
    const integrationA = await seedGiteaIntegration(projectA.id, "secret-a");
    await seedGiteaIntegration(projectB.id, "secret-b");

    const matches = await findAllIntegrationsByGiteaRepo(
      "https://gitea.example.com",
      "acme",
      "app",
      integrationA.id,
    );

    expect(matches.map((integration) => integration.id)).toEqual([
      integrationA.id,
    ]);
  });

  it("hides the webhook secret from members who cannot manage settings", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    await seedGiteaIntegration(project.id, "top-secret");

    const member = await createWorkspaceMember();
    await addWorkspaceUser(owner.workspace.id, member.user.id, "member");

    mockAuthenticatedSession(member.user);
    const memberApp = createApp().app;
    const memberResponse = await memberApp.request(
      `/api/gitea-integration/project/${project.id}`,
    );
    expect(memberResponse.status).toBe(200);
    const memberBody = (await memberResponse.json()) as {
      webhookSecret: string;
    };
    expect(memberBody.webhookSecret).toBe("");

    mockAuthenticatedSession(owner.user);
    const ownerApp = createApp().app;
    const ownerResponse = await ownerApp.request(
      `/api/gitea-integration/project/${project.id}`,
    );
    const ownerBody = (await ownerResponse.json()) as {
      webhookSecret: string;
    };
    expect(ownerBody.webhookSecret).toBe("top-secret");
  });
});
