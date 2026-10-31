import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { canInProject } from "../../apps/api/src/project-rbac/can-in-project";
import {
  addProjectMemberWithRole,
  seedProjectRoles,
} from "../../apps/api/src/project-rbac/seed-default-project-roles";
import { storage } from "../../apps/api/src/storage";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function getProjectRoleId(projectId: string, name: string) {
  const [role] = await db
    .select({ id: schema.projectRoleTable.id })
    .from(schema.projectRoleTable)
    .where(
      and(
        eq(schema.projectRoleTable.projectId, projectId),
        eq(schema.projectRoleTable.name, name),
      ),
    )
    .limit(1);
  if (!role) throw new Error(`Role ${name} not seeded`);
  return role.id;
}

async function getProjectMemberId(projectId: string, userId: string) {
  const [member] = await db
    .select({ id: schema.projectMemberTable.id })
    .from(schema.projectMemberTable)
    .where(
      and(
        eq(schema.projectMemberTable.projectId, projectId),
        eq(schema.projectMemberTable.userId, userId),
      ),
    )
    .limit(1);
  if (!member) throw new Error("Project member not seeded");
  return member.id;
}

// Attacker owns project A in their own workspace and is only a Viewer in
// project B, which belongs to the victim's workspace.
async function seedCrossTenantProjects() {
  const attacker = await createWorkspaceMember({ role: "owner" });
  const victim = await createWorkspaceMember({ role: "owner" });
  const { project: projectA } = await createProjectFixture({
    workspaceId: attacker.workspace.id,
  });
  const { project: projectB } = await createProjectFixture({
    workspaceId: victim.workspace.id,
  });

  await seedProjectRoles(db, projectA.id);
  await seedProjectRoles(db, projectB.id);
  await addProjectMemberWithRole(db, projectA.id, attacker.user.id, "Owner");

  await db.insert(schema.workspaceUserTable).values({
    workspaceId: victim.workspace.id,
    userId: attacker.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  await addProjectMemberWithRole(db, projectB.id, attacker.user.id, "Viewer");

  return { attacker, victim, projectA, projectB };
}

describe("API integration: access isolation", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("ignores a caller-supplied workspaceId on project routes", async () => {
    const attacker = await createWorkspaceMember({ role: "owner" });
    const victim = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: victim.workspace.id,
    });

    mockAuthenticatedSession(attacker.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/all/${project.id}?workspaceId=${attacker.workspace.id}`,
    );

    expect(response.status).toBe(403);
  });

  it("rejects attaching another project's role to a member", async () => {
    const { attacker, projectA, projectB } = await seedCrossTenantProjects();
    const ownerRoleA = await getProjectRoleId(projectA.id, "Owner");
    const attackerMemberB = await getProjectMemberId(
      projectB.id,
      attacker.user.id,
    );

    mockAuthenticatedSession(attacker.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-rbac/${projectA.id}/members/${attackerMemberB}/roles`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleIds: [ownerRoleA] }),
      },
    );

    expect(response.status).toBe(404);
    await expect(
      canInProject(attacker.user.id, projectB.id, "member", "manage"),
    ).resolves.toBe(false);
  });

  it("rejects roles from another project even on the right member", async () => {
    const { attacker, projectA, projectB } = await seedCrossTenantProjects();
    const ownerRoleB = await getProjectRoleId(projectB.id, "Owner");
    const attackerMemberA = await getProjectMemberId(
      projectA.id,
      attacker.user.id,
    );

    mockAuthenticatedSession(attacker.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-rbac/${projectA.id}/members/${attackerMemberA}/roles`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleIds: [ownerRoleB] }),
      },
    );

    expect(response.status).toBe(400);
  });

  it("does not grant permissions from a role that belongs to another project", async () => {
    const { attacker, projectA, projectB } = await seedCrossTenantProjects();
    const ownerRoleA = await getProjectRoleId(projectA.id, "Owner");
    const attackerMemberB = await getProjectMemberId(
      projectB.id,
      attacker.user.id,
    );

    // Simulate a foreign role row that predates the API check.
    await db.insert(schema.projectMemberRoleTable).values({
      projectMemberId: attackerMemberB,
      projectRoleId: ownerRoleA,
    });

    await expect(
      canInProject(attacker.user.id, projectB.id, "member", "manage"),
    ).resolves.toBe(false);
  });

  it("rejects removing a member through another project's URL", async () => {
    const { attacker, victim, projectA, projectB } =
      await seedCrossTenantProjects();
    await addProjectMemberWithRole(db, projectB.id, victim.user.id, "Member");
    const victimMemberB = await getProjectMemberId(projectB.id, victim.user.id);

    mockAuthenticatedSession(attacker.user);
    const { app } = createApp();

    const response = await app.request(
      `/api/project-rbac/${projectA.id}/members/${victimMemberB}`,
      { method: "DELETE" },
    );

    expect(response.status).toBe(404);
    const stillThere = await db.query.projectMemberTable.findFirst({
      where: eq(schema.projectMemberTable.id, victimMemberB),
    });
    expect(stillThere).toBeDefined();
  });
});

describe("API integration: MCP authorization consent", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function registerClient(
    app: ReturnType<typeof createApp>["app"],
    redirectUri: string,
  ) {
    const response = await app.request("/api/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        client_name: "Test client",
      }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { client_id: string };
    return body.client_id;
  }

  it("rejects a redirect_uri the client did not register", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const clientId = await registerClient(app, "http://127.0.0.1:3334/cb");

    const response = await app.request(
      `/api/mcp/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent("https://evil.example/cb")}&code_challenge=abc`,
    );

    expect(response.status).toBe(400);
  });

  it("sends signed-in users to the consent page instead of issuing a code", async () => {
    const member = await createWorkspaceMember();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const redirectUri = "http://127.0.0.1:3334/cb";
    const clientId = await registerClient(app, redirectUri);

    const authorize = await app.request(
      `/api/mcp/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&code_challenge=abc&state=xyz`,
    );
    expect(authorize.status).toBe(302);
    const location = new URL(authorize.headers.get("location") ?? "");
    expect(location.origin).toBe("http://localhost:5173");
    expect(location.pathname).toBe("/mcp/authorize");
    const requestId = location.searchParams.get("request_id");
    expect(requestId).toBeTruthy();

    const crossSite = await app.request(
      `/api/mcp/authorize/requests/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(crossSite.status).toBe(403);

    const approved = await app.request(
      `/api/mcp/authorize/requests/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(approved.status).toBe(200);
    const { redirect } = (await approved.json()) as { redirect: string };
    const redirectUrl = new URL(redirect);
    expect(`${redirectUrl.origin}${redirectUrl.pathname}`).toBe(redirectUri);
    expect(redirectUrl.searchParams.get("code")).toBeTruthy();
    expect(redirectUrl.searchParams.get("state")).toBe("xyz");
  });
});

describe("API integration: asset download", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  async function seedAsset(mimeType: string, filename: string) {
    const member = await createWorkspaceMember();
    const { project, columns } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Asset host",
        priority: "low",
        status: "to-do",
        columnId: columns.todo.id,
        number: 1,
        position: 1,
      })
      .returning();
    const objectKey = `integration/${randomUUID()}/${filename}`;
    await storage.put(objectKey, Buffer.from("<script>1</script>"), mimeType);
    const [asset] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: member.workspace.id,
        projectId: project.id,
        taskId: task.id,
        objectKey,
        filename,
        mimeType,
        size: 18,
        kind: "attachment",
        surface: "description",
        createdBy: member.user.id,
      })
      .returning({ id: schema.assetTable.id });
    return { member, assetId: asset.id };
  }

  it("serves locally stored HTML as a sandboxed download", async () => {
    const { member, assetId } = await seedAsset("text/html", "page.html");
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/asset/${assetId}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-security-policy")).toContain(
      "sandbox",
    );
  });

  it("keeps raster images inline", async () => {
    const { member, assetId } = await seedAsset("image/png", "wave.png");
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request(`/api/asset/${assetId}`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(response.headers.get("content-disposition")).toContain(
      'filename="wave.png"',
    );
  });
});
