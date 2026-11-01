import { randomUUID } from "node:crypto";
import type { Session, User } from "better-auth/types";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testEmailLimiter } from "../../apps/api/src/admin/controllers/send-test-email";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { invalidateInstanceSettings } from "../../apps/api/src/instance-settings/get-instance-settings";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture, joinProject } from "./helpers/fixtures";
import { sentTestEmails } from "./mocks/email";

const origin = "http://localhost:5173";

type UserRow = typeof schema.userTable.$inferSelect;

async function createUser(role: "admin" | "user" = "user"): Promise<UserRow> {
  const id = `user-${randomUUID()}`;
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id,
      email: `${id}@example.com`,
      emailVerified: true,
      name: role === "admin" ? "Admin" : "Member",
      role,
    })
    .returning();
  return user;
}

function sessionFor(user: UserRow): { session: Session; user: User } {
  const now = new Date();
  return {
    session: {
      id: `session-${user.id}`,
      token: `token-${user.id}`,
      userId: user.id,
      expiresAt: new Date(now.getTime() + 3600_000),
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    },
    user: user as unknown as User,
  };
}

function mockSessions(users: UserRow[]) {
  return vi.spyOn(auth.api, "getSession").mockImplementation((async ({
    headers,
  }: {
    headers: Headers;
  }) => {
    const id = headers.get("x-test-user");
    const user = users.find((candidate) => candidate.id === id);
    return user ? sessionFor(user) : null;
  }) as unknown as typeof auth.api.getSession);
}

async function auditActions() {
  const rows = await db
    .select({ action: schema.adminAuditLogTable.action })
    .from(schema.adminAuditLogTable);
  return rows.map((row) => row.action);
}

async function saveSettings(
  values: Partial<typeof schema.instanceSettingsTable.$inferInsert>,
) {
  await db
    .insert(schema.instanceSettingsTable)
    .values({ id: "instance", ...values })
    .onConflictDoUpdate({
      target: schema.instanceSettingsTable.id,
      set: values,
    });
  invalidateInstanceSettings();
}

function mergeCookieJar(jar: string, res: Response) {
  const pairs = (res.headers.getSetCookie?.() ?? [])
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean);
  return pairs.length ? `${jar}; ${pairs.join("; ")}` : jar;
}

function randomIp() {
  return `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

describe("API integration: instance settings, system and workspace lifecycle", () => {
  let app: ReturnType<typeof createApp>["app"];
  let admin: UserRow;
  let member: UserRow;

  const call = (
    as: UserRow | null,
    method: string,
    path: string,
    body?: unknown,
  ) =>
    app.request(`/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(as ? { "x-test-user": as.id } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  const signUp = (email: string) =>
    app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
        Cookie: "csrf=1",
        "x-forwarded-for": randomIp(),
      },
      body: JSON.stringify({
        name: "New person",
        email,
        password: "correct-horse-battery-staple",
      }),
    });

  beforeEach(async () => {
    await resetTestDatabase();
    await db.delete(schema.instanceSettingsTable);
    await db.delete(schema.adminAuditLogTable);
    invalidateInstanceSettings();
    testEmailLimiter.reset();
    sentTestEmails.length = 0;
    app = createApp().app;
    admin = await createUser("admin");
    member = await createUser("user");
  });

  afterEach(() => {
    process.env.DISABLE_REGISTRATION = "false";
    process.env.SMTP_HOST = "";
    process.env.SMTP_PORT = "";
    process.env.SMTP_FROM = "";
    invalidateInstanceSettings();
  });

  it("refuses every new admin route to non-admins and anonymous callers", async () => {
    mockSessions([admin, member]);
    const routes: [string, string, unknown?][] = [
      ["GET", "/admin/system"],
      ["POST", "/admin/system/verify-smtp"],
      ["POST", "/admin/system/test-email"],
      ["GET", "/admin/settings"],
      ["PATCH", "/admin/settings", { registrationEnabled: false }],
      ["GET", "/admin/workspaces"],
      ["POST", "/admin/workspaces/w1/archive"],
      ["POST", "/admin/workspaces/w1/unarchive"],
      ["DELETE", "/admin/workspaces/w1", { confirmName: "x" }],
    ];
    for (const [method, path, body] of routes) {
      const asMember = await call(member, method, path, body);
      expect(asMember.status, `${method} ${path}`).toBe(403);
      const anonymous = await call(null, method, path, body);
      expect(anonymous.status, `${method} ${path}`).toBe(401);
    }
    expect(await auditActions()).toEqual([]);
  });

  it("reports system status without secrets", async () => {
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_FROM = "kaneo@example.com";
    process.env.SMTP_PASSWORD = "do-not-leak";
    mockSessions([admin]);
    const res = await call(admin, "GET", "/admin/system");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("do-not-leak");
    const body = JSON.parse(text);
    expect(body.database.status).toBe("ok");
    expect(body.database.migrationsApplied).toBeGreaterThan(0);
    expect(body.redis.status).toBe("not_configured");
    expect(body.email.configured).toBe(true);
    expect(typeof body.uptimeSeconds).toBe("number");
    process.env.SMTP_PASSWORD = "";
  });

  it("verifies SMTP and sends a rate-limited, audited test email to the caller", async () => {
    mockSessions([admin]);
    const notConfigured = await call(admin, "POST", "/admin/system/test-email");
    expect(notConfigured.status).toBe(409);

    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "587";
    process.env.SMTP_FROM = "kaneo@example.com";

    const verify = await call(admin, "POST", "/admin/system/verify-smtp");
    expect(verify.status).toBe(200);
    expect(await verify.json()).toMatchObject({ status: "ok" });

    for (let i = 0; i < 5; i++) {
      const sent = await call(admin, "POST", "/admin/system/test-email");
      expect(sent.status).toBe(200);
    }
    expect(sentTestEmails.map((mail) => mail.to)).toEqual(
      Array(5).fill(admin.email),
    );
    const limited = await call(admin, "POST", "/admin/system/test-email");
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBeTruthy();

    const actions = await auditActions();
    expect(actions).toContain("email.smtp_verified");
    expect(actions.filter((a) => a === "email.test_sent")).toHaveLength(5);
  });

  it("lets environment variables override database settings", async () => {
    mockSessions([admin]);
    await saveSettings({ registrationEnabled: true });
    process.env.DISABLE_REGISTRATION = "true";
    invalidateInstanceSettings();

    const settings = await (await call(admin, "GET", "/admin/settings")).json();
    expect(settings.registrationEnabled).toBe(false);
    expect(settings.lockedByEnv).toContain("registrationEnabled");

    const locked = await call(admin, "PATCH", "/admin/settings", {
      registrationEnabled: true,
    });
    expect(locked.status).toBe(409);

    const config = await (await app.request("/api/config")).json();
    expect(config.disableRegistration).toBe(true);

    const blocked = await signUp(`env-${randomUUID()}@example.com`);
    expect(blocked.status).toBe(403);
  });

  it("updates settings, audits the change and blocks sign-up when registration is disabled in the database", async () => {
    mockSessions([admin]);
    const res = await call(admin, "PATCH", "/admin/settings", {
      registrationEnabled: false,
      instanceName: "Acme PM",
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      registrationEnabled: false,
      instanceName: "Acme PM",
      lockedByEnv: [],
    });

    const config = await (await app.request("/api/config")).json();
    expect(config).toMatchObject({
      disableRegistration: true,
      instanceName: "Acme PM",
    });

    const blocked = await signUp(`db-${randomUUID()}@example.com`);
    expect(blocked.status).toBe(403);

    const [entry] = await db
      .select()
      .from(schema.adminAuditLogTable)
      .where(eq(schema.adminAuditLogTable.action, "instance.settings_updated"));
    expect(entry?.metadata).toMatchObject({
      changes: expect.arrayContaining([
        { setting: "registrationEnabled", from: true, to: false },
      ]),
    });

    await call(admin, "PATCH", "/admin/settings", {
      registrationEnabled: true,
      passwordRegistrationEnabled: false,
    });
    const passwordBlocked = await signUp(`pw-${randomUUID()}@example.com`);
    expect(passwordBlocked.status).toBe(403);

    await call(admin, "PATCH", "/admin/settings", {
      passwordRegistrationEnabled: true,
    });
    const allowed = await signUp(`ok-${randomUUID()}@example.com`);
    expect(allowed.status).toBe(200);
  });

  it("requires email verification at runtime when the database toggle is on", async () => {
    await saveSettings({ requireEmailVerification: true });
    const email = `verify-${randomUUID()}@example.com`;
    const signedUp = await signUp(email);
    expect(signedUp.status).toBe(200);
    expect((await signedUp.json()).token).toBeNull();

    const signIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
        Cookie: "csrf=1",
        "x-forwarded-for": randomIp(),
      },
      body: JSON.stringify({
        email,
        password: "correct-horse-battery-staple",
      }),
    });
    expect(signIn.status).toBe(403);
    expect((await signIn.json()).code).toBe("EMAIL_NOT_VERIFIED");

    await saveSettings({ requireEmailVerification: false });
    const later = await signUp(`free-${randomUUID()}@example.com`);
    expect((await later.json()).token).toEqual(expect.any(String));
  });

  it("restricts workspace creation to instance admins", async () => {
    await saveSettings({ workspaceCreationRestricted: true });

    const email = `creator-${randomUUID()}@example.com`;
    const signedUp = await signUp(email);
    expect(signedUp.status).toBe(200);
    const jar = mergeCookieJar("csrf=1", signedUp);
    const create = (cookie: string) =>
      app.request("/api/auth/organization/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: origin,
          Cookie: cookie,
        },
        body: JSON.stringify({
          name: "Side project",
          slug: `side-${randomUUID()}`,
        }),
      });

    const refused = await create(jar);
    expect(refused.status).toBe(403);

    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.email, email));
    const allowed = await create(jar);
    expect(allowed.status).toBe(200);

    await saveSettings({ workspaceCreationRestricted: false });
    await db
      .update(schema.userTable)
      .set({ role: "user" })
      .where(eq(schema.userTable.email, email));
    const unrestricted = await create(jar);
    expect(unrestricted.status).toBe(200);
  });

  it("forbids changing integrations an admin turned off", async () => {
    mockSessions([admin]);
    await call(admin, "PATCH", "/admin/settings", {
      disabledIntegrations: ["telegram"],
    });
    const res = await call(
      admin,
      "POST",
      "/telegram-integration/project/project-x",
      {
        chatId: "1",
      },
    );
    expect(res.status).toBe(403);
  });

  it("makes archived workspaces read-only, restores them, and deletes them with confirmation", async () => {
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({
        id: `workspace-${randomUUID()}`,
        name: "Archive Me",
        slug: `archive-${randomUUID()}`,
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: member.id,
      role: "admin",
      joinedAt: new Date(),
    });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await joinProject(project.id, member.id, "Admin");
    mockSessions([admin, member]);

    const archived = await call(
      admin,
      "POST",
      `/admin/workspaces/${workspace.id}/archive`,
    );
    expect(archived.status).toBe(200);
    expect(await archived.json()).toMatchObject({ changed: true });

    const status = await call(
      member,
      "GET",
      `/workspace/${workspace.id}/archive-status`,
    );
    expect(await status.json()).toMatchObject({ archived: true });

    const read = await call(member, "GET", `/project/${project.id}`);
    expect(read.status).toBe(200);

    const update = await call(member, "PUT", `/project/${project.id}`, {
      name: "Renamed",
      icon: "Folder",
      slug: project.slug,
      description: "",
      isPublic: false,
    });
    expect(update.status).toBe(409);

    const createTask = await call(member, "POST", `/task/${project.id}`, {
      title: "New task",
      description: "",
      priority: "low",
    });
    expect(createTask.status).toBe(409);

    // Archived means read-only for instance admins too.
    const adminWrite = await call(admin, "POST", "/project", {
      workspaceId: workspace.id,
      name: "Another",
      icon: "Folder",
      slug: `another-${randomUUID()}`,
    });
    expect(adminWrite.status).toBe(409);

    const listed = await (
      await call(admin, "GET", "/admin/workspaces?status=archived")
    ).json();
    expect(listed.workspaces.map((w: { id: string }) => w.id)).toEqual([
      workspace.id,
    ]);

    const restored = await call(
      admin,
      "POST",
      `/admin/workspaces/${workspace.id}/unarchive`,
    );
    expect(await restored.json()).toMatchObject({
      archivedAt: null,
      changed: true,
    });
    const updateAfter = await call(member, "PUT", `/project/${project.id}`, {
      name: "Renamed",
      icon: "Folder",
      slug: project.slug,
      description: "",
      isPublic: false,
    });
    expect(updateAfter.status).toBe(200);

    const wrongName = await call(
      admin,
      "DELETE",
      `/admin/workspaces/${workspace.id}`,
      { confirmName: "Nope" },
    );
    expect(wrongName.status).toBe(400);

    const deleted = await call(
      admin,
      "DELETE",
      `/admin/workspaces/${workspace.id}`,
      { confirmName: "Archive Me" },
    );
    expect(deleted.status).toBe(200);
    const memberships = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, workspace.id));
    expect(memberships).toEqual([]);
    const projects = await db
      .select()
      .from(schema.projectTable)
      .where(eq(schema.projectTable.id, project.id));
    expect(projects).toEqual([]);
    const afterDelete = await call(member, "GET", `/project/${project.id}`);
    expect(afterDelete.status).not.toBe(200);

    expect(await auditActions()).toEqual(
      expect.arrayContaining([
        "workspace.archived",
        "workspace.restored",
        "workspace.deleted",
      ]),
    );
  });
});
