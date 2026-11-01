import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import * as drive from "../../apps/api/src/document/drive/client";
import { createApp } from "../../apps/api/src/index";
import { invalidateInstanceSettings } from "../../apps/api/src/instance-settings/get-instance-settings";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
  joinProject,
} from "./helpers/fixtures";
import { sentFeedback } from "./mocks/email";

vi.mock("../../apps/api/src/utils/public-fetch", () => ({
  publicFetch: vi.fn(async () => {
    throw new Error("Unexpected outbound request in test");
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await db.delete(schema.instanceSettingsTable);
  invalidateInstanceSettings();
  delete process.env.FEEDBACK_EMAIL;
  sentFeedback.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

async function owner() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await joinProject(project.id, user.id, "Owner");
  mockAuthenticatedSession(user);
  const { app } = createApp();
  return { user, project, workspace, app };
}

const headers = {
  "content-type": "application/json",
  origin: "http://localhost:5173",
};

async function credentials(
  app: ReturnType<typeof createApp>["app"],
  projectId: string,
) {
  return app.request(
    `/api/google-drive-integration/project/${projectId}/credentials`,
    {
      method: "PUT",
      headers,
      body: JSON.stringify({
        clientId: "client.apps.googleusercontent.com",
        clientSecret: "top-secret-value",
      }),
    },
  );
}

describe("Google Drive connection", () => {
  it("encrypts credentials and does not disclose them from status", async () => {
    const { app, project } = await owner();
    expect((await credentials(app, project.id)).status).toBe(200);
    const [row] = await db
      .select()
      .from(schema.integrationTable)
      .where(eq(schema.integrationTable.projectId, project.id));
    expect(row.config).not.toContain("top-secret-value");
    const result = await app.request(
      `/api/google-drive-integration/project/${project.id}`,
    );
    expect(result.status).toBe(200);
    expect(await result.text()).not.toMatch(
      /clientSecret|top-secret-value|refreshToken/,
    );
  });

  it("rejects a project from another workspace", async () => {
    const { app } = await owner();
    const other = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    expect((await credentials(app, project.id)).status).toBe(403);
  });

  it("binds OAuth state to the browser and rejects replay", async () => {
    const { app, project } = await owner();
    await credentials(app, project.id);
    const begin = await app.request(
      `/api/google-drive-integration/project/${project.id}/connect`,
      { method: "POST", headers },
    );
    expect(begin.status).toBe(200);
    const url = new URL((await begin.json()).url);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://localhost:1337/api/google-drive-integration/callback",
    );
    const state = url.searchParams.get("state");
    const cookie = begin.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toContain("kaneo_drive_oauth=");
    const exchange = vi
      .spyOn(drive, "exchangeCodeForTokens")
      .mockResolvedValue({
        access_token: "access",
        refresh_token: "refresh",
        expires_in: 3600,
        scope: "drive",
      });
    vi.spyOn(drive, "getUserEmail").mockResolvedValue("owner@example.com");
    // A copied callback URL in another browser cannot attach an account.
    await app.request(
      `/api/google-drive-integration/callback?state=${state}&code=code`,
    );
    expect(exchange).not.toHaveBeenCalled();
    const callback = `/api/google-drive-integration/callback?state=${state}&code=code`;
    const accepted = await app.request(callback, {
      headers: { cookie: cookie ?? "" },
    });
    expect(accepted.headers.get("location")).toContain("drive=connected");
    await app.request(callback, { headers: { cookie: cookie ?? "" } });
    expect(exchange).toHaveBeenCalledTimes(1);
  });

  it("rechecks workspace membership after the consent round trip", async () => {
    const { app, project, user } = await owner();
    await credentials(app, project.id);
    const begin = await app.request(
      `/api/google-drive-integration/project/${project.id}/connect`,
      { method: "POST", headers },
    );
    const state = new URL((await begin.json()).url).searchParams.get("state");
    await db
      .delete(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, user.id));
    const exchange = vi.spyOn(drive, "exchangeCodeForTokens");
    const response = await app.request(
      `/api/google-drive-integration/callback?state=${state}&code=code`,
      {
        headers: {
          cookie: begin.headers.get("set-cookie")?.split(";")[0] ?? "",
        },
      },
    );
    expect(response.headers.get("location")).toContain("drive=error");
    expect(exchange).not.toHaveBeenCalled();
  });

  it.each([
    "membership",
    "archive",
    "disabled",
    "ban",
  ] as const)("does not persist OAuth tokens if %s changes during token exchange", async (change) => {
    const { app, project, user, workspace } = await owner();
    await credentials(app, project.id);
    const begin = await app.request(
      `/api/google-drive-integration/project/${project.id}/connect`,
      { method: "POST", headers },
    );
    const state = new URL((await begin.json()).url).searchParams.get("state");
    let reached!: () => void;
    let release!: () => void;
    const atExchange = new Promise<void>((resolve) => {
      reached = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(drive, "exchangeCodeForTokens").mockImplementation(async () => {
      reached();
      await barrier;
      return {
        access_token: "access",
        refresh_token: "new-refresh",
        expires_in: 3600,
        scope: "drive",
      };
    });
    vi.spyOn(drive, "getUserEmail").mockResolvedValue("owner@example.com");
    const pending = app.request(
      `/api/google-drive-integration/callback?state=${state}&code=code`,
      {
        headers: {
          cookie: begin.headers.get("set-cookie")?.split(";")[0] ?? "",
        },
      },
    );
    await atExchange;
    if (change === "membership")
      await db
        .delete(schema.workspaceUserTable)
        .where(eq(schema.workspaceUserTable.userId, user.id));
    if (change === "archive")
      await db
        .update(schema.workspaceTable)
        .set({ archivedAt: new Date() })
        .where(eq(schema.workspaceTable.id, workspace.id));
    if (change === "disabled") {
      await db
        .insert(schema.instanceSettingsTable)
        .values({ id: "instance", disabledIntegrations: ["google-drive"] });
      invalidateInstanceSettings();
    }
    if (change === "ban")
      await db
        .update(schema.userTable)
        .set({ banned: true })
        .where(eq(schema.userTable.id, user.id));
    release();
    const response = await pending;
    expect(response.headers.get("location")).toContain("drive=error");
    const [row] = await db
      .select()
      .from(schema.integrationTable)
      .where(eq(schema.integrationTable.projectId, project.id));
    expect(JSON.parse(row.config).refreshToken).toBeUndefined();
  });

  it("blocks reconnecting disabled Drive while allowing disconnect", async () => {
    const { app, project } = await owner();
    await credentials(app, project.id);
    await db
      .insert(schema.instanceSettingsTable)
      .values({ id: "instance", disabledIntegrations: ["google-drive"] });
    invalidateInstanceSettings();
    expect((await credentials(app, project.id)).status).toBe(403);
    const result = await app.request(
      `/api/google-drive-integration/project/${project.id}`,
      { method: "DELETE", headers },
    );
    expect(result.status).toBe(200);
    expect(await db.select().from(schema.integrationTable)).toHaveLength(0);
  });

  it("preserves Drive originals when purging a linked document", async () => {
    const { app, project, user } = await owner();
    const [doc] = await db
      .insert(schema.documentTable)
      .values({
        projectId: project.id,
        name: "Linked",
        source: "google_drive",
        storageKey: null,
        externalId: "file",
        driveManaged: false,
        size: 0,
        contentType: "text/plain",
        createdBy: user.id,
      })
      .returning();
    const remove = vi.spyOn(drive, "deleteFile");
    const result = await app.request(`/api/document/${doc.id}/purge`, {
      method: "DELETE",
      headers,
    });
    expect(result.status).toBe(200);
    expect(remove).not.toHaveBeenCalled();
  });
});

describe("feedback", () => {
  it("uses the configured inbox and limits repeated submissions", async () => {
    const { app } = await owner();
    vi.stubEnv("FEEDBACK_EMAIL", "feedback@example.com");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "25");
    vi.stubEnv("SMTP_FROM", "kaneo@example.com");
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await app.request("/api/feedback", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "A useful suggestion" }),
      });
      expect(response.status).toBe(200);
    }
    expect(sentFeedback).toHaveLength(5);
    expect(sentFeedback[0]).toMatchObject({
      to: "feedback@example.com",
      message: "A useful suggestion",
    });
    const limited = await app.request("/api/feedback", {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "One too many" }),
    });
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(sentFeedback).toHaveLength(5);
  });

  it("is unavailable without an explicitly configured recipient", async () => {
    const { app } = await owner();
    const response = await app.request("/api/feedback", {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "A suggestion" }),
    });
    expect(response.status).toBe(503);
    expect(await response.text()).toContain("FEEDBACK_NOT_CONFIGURED");
  });

  it("rejects empty feedback before calling SMTP", async () => {
    const { app } = await owner();
    const response = await app.request("/api/feedback", {
      method: "POST",
      headers,
      body: JSON.stringify({ message: "   " }),
    });
    expect(response.status).toBe(400);
  });
});
