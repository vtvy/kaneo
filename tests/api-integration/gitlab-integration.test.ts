import { beforeEach, describe, expect, it, vi } from "vitest";

// Status changes fire outbound GitLab sync; keep the tests off the network.
vi.mock("../../apps/api/src/utils/public-fetch", () => ({
  publicFetch: vi.fn(async () => new Response("{}", { status: 404 })),
}));

const { eq } = await import("drizzle-orm");
const { default: db, schema } = await import("../../apps/api/src/database");
const { createApp } = await import("../../apps/api/src/index");
const { mockAuthenticatedSession } = await import("./helpers/auth");
const { resetTestDatabase } = await import("./helpers/database");
const { createProjectFixture, createWorkspaceMember } = await import(
  "./helpers/fixtures"
);

beforeEach(resetTestDatabase);

const ACCESS_TOKEN = "glpat-super-secret-token-value";
const repo = {
  baseUrl: "https://gitlab.example.com",
  repositoryOwner: "group/sub",
  repositoryName: "shared-repo",
};

async function linkedProject(secret: string, role = "admin") {
  const member = await createWorkspaceMember({ role });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "gitlab",
      isActive: true,
      config: JSON.stringify({
        ...repo,
        accessToken: ACCESS_TOKEN,
        webhookSecret: secret,
        branchPattern: "{slug}-{number}",
      }),
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Linked task",
      number: 1,
      status: "to-do",
      columnId: columns.todo.id,
    })
    .returning();
  const [link] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "5",
      url: `${repo.baseUrl}/group/sub/shared-repo/-/issues/5`,
      title: "Issue 5",
      metadata: JSON.stringify({ state: "open" }),
    })
    .returning();
  return { member, project, integration, task, link };
}

function issueClosedEvent() {
  return JSON.stringify({
    object_kind: "issue",
    event_type: "issue",
    user: { username: "someone" },
    project: {
      name: "Shared Repo",
      path: "shared-repo",
      path_with_namespace: "group/sub/shared-repo",
      // GitLab may report a different host than the one Kaneo connects to.
      web_url: "https://gitlab.internal.example/group/sub/shared-repo",
    },
    object_attributes: {
      id: 500,
      iid: 5,
      title: "Issue 5",
      action: "close",
      state: "closed",
      url: "https://gitlab.internal.example/group/sub/shared-repo/-/issues/5",
    },
  });
}

async function sendWebhook(integrationId: string, token: string | null) {
  const { app } = createApp();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-gitlab-event": "Issue Hook",
  };
  if (token !== null) headers["x-gitlab-token"] = token;
  return app.request(`/api/gitlab-integration/webhook/${integrationId}`, {
    method: "POST",
    headers,
    body: issueClosedEvent(),
  });
}

async function taskStatus(taskId: string) {
  const task = await db.query.taskTable.findFirst({
    where: eq(schema.taskTable.id, taskId),
  });
  return task?.status;
}

describe("GitLab webhooks", () => {
  it("only acts on the integration whose secret matched", async () => {
    const a = await linkedProject("secret-a-0123456789abcdef");
    const b = await linkedProject("secret-b-0123456789abcdef");

    const res = await sendWebhook(
      a.integration.id,
      "secret-a-0123456789abcdef",
    );
    expect(res.status).toBe(200);

    expect(await taskStatus(a.task.id)).toBe("done");
    expect(await taskStatus(b.task.id)).toBe("to-do");

    const linkB = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.id, b.link.id),
    });
    expect(JSON.parse(linkB?.metadata ?? "{}").state).toBe("open");
  });

  it("rejects another integration's secret and a missing token", async () => {
    const a = await linkedProject("secret-a-0123456789abcdef");
    const b = await linkedProject("secret-b-0123456789abcdef");

    const wrong = await sendWebhook(
      a.integration.id,
      "secret-b-0123456789abcdef",
    );
    expect(wrong.status).toBe(401);

    const missing = await sendWebhook(a.integration.id, null);
    expect(missing.status).toBe(401);

    expect(await taskStatus(a.task.id)).toBe("to-do");
    expect(await taskStatus(b.task.id)).toBe("to-do");
  });

  it("returns 404 for an unknown integration", async () => {
    const res = await sendWebhook("does-not-exist", "anything");
    expect(res.status).toBe(404);
  });
});

describe("GitLab integration secrets", () => {
  async function getIntegration(role: string) {
    const linked = await linkedProject("secret-a-0123456789abcdef", role);
    mockAuthenticatedSession(linked.member.user);
    const { app } = createApp();
    const res = await app.request(
      `/api/gitlab-integration/project/${linked.project.id}`,
    );
    return { res, text: await res.text() };
  }

  it("never returns the access token, even to settings managers", async () => {
    const { res, text } = await getIntegration("admin");
    expect(res.status).toBe(200);
    expect(text).not.toContain(ACCESS_TOKEN);
    const body = JSON.parse(text);
    expect(body.maskedAccessToken).toMatch(/•/);
    expect(body.webhookSecret).toBe("secret-a-0123456789abcdef");
    expect(body.repositoryOwner).toBe("group/sub");
  });

  it("hides the webhook secret and token hint from regular members", async () => {
    const { res, text } = await getIntegration("member");
    expect(res.status).toBe(200);
    expect(text).not.toContain(ACCESS_TOKEN);
    expect(text).not.toContain("secret-a-0123456789abcdef");
    const body = JSON.parse(text);
    expect(body.webhookSecret).toBe("");
    expect(body.maskedAccessToken).toBe("");
  });

  it("requires manage_settings to probe a GitLab URL or change settings", async () => {
    const linked = await linkedProject("secret-a-0123456789abcdef", "member");
    mockAuthenticatedSession(linked.member.user);
    const { app } = createApp();
    const json = { "content-type": "application/json" };

    const verify = await app.request("/api/gitlab-integration/verify", {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        projectId: linked.project.id,
        baseUrl: "https://gitlab.example.com",
        accessToken: "x",
        repositoryOwner: "a",
        repositoryName: "b",
      }),
    });
    expect(verify.status).toBe(403);

    const update = await app.request(
      `/api/gitlab-integration/project/${linked.project.id}`,
      {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({ isActive: false }),
      },
    );
    expect(update.status).toBe(403);
  });
});
