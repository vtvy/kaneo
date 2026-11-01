import { createHash, randomUUID } from "node:crypto";
import type { Session, User } from "better-auth/types";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

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

// Resolves the caller from an `x-test-user` header so concurrent requests can
// act as different users. Requests without it are anonymous.
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

function hashApiKey(key: string) {
  return createHash("sha256")
    .update(key)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

async function insertApiKey(userId: string, rawKey = `kaneo_${randomUUID()}`) {
  const now = new Date();
  const [row] = await db
    .insert(schema.apikeyTable)
    .values({
      name: "CLI",
      start: rawKey.slice(0, 6),
      prefix: "kaneo_",
      key: hashApiKey(rawKey),
      referenceId: userId,
      userId,
      enabled: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return { row, rawKey };
}

async function auditActions() {
  const rows = await db
    .select({ action: schema.adminAuditLogTable.action })
    .from(schema.adminAuditLogTable);
  return rows.map((row) => row.action);
}

describe("API integration: instance administration", () => {
  let app: ReturnType<typeof createApp>["app"];
  let admin: UserRow;
  let member: UserRow;

  const call = (
    as: UserRow | null,
    method: string,
    path: string,
    body?: unknown,
  ) =>
    app.request(`/api/admin${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(as ? { "x-test-user": as.id } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  beforeEach(async () => {
    await resetTestDatabase();
    app = createApp().app;
    admin = await createUser("admin");
    member = await createUser("user");
  });

  it("refuses every admin route to non-admins and anonymous callers", async () => {
    mockSessions([admin, member]);
    const routes: [string, string, unknown?][] = [
      ["GET", "/users"],
      ["POST", "/users", { name: "X", email: "x@example.com" }],
      ["PATCH", `/users/${admin.id}/role`, { role: "user" }],
      ["POST", `/users/${admin.id}/ban`, {}],
      ["POST", `/users/${admin.id}/unban`],
      ["DELETE", `/users/${admin.id}`],
      ["GET", `/users/${admin.id}/sessions`],
      ["DELETE", `/users/${admin.id}/sessions`],
      ["DELETE", `/users/${admin.id}/sessions/s1`],
      ["GET", `/users/${admin.id}/api-keys`],
      ["DELETE", `/users/${admin.id}/api-keys`],
      ["DELETE", `/users/${admin.id}/api-keys/k1`],
      ["GET", "/audit-log"],
    ];

    for (const [method, path, body] of routes) {
      const asMember = await call(member, method, path, body);
      expect(asMember.status, `${method} ${path}`).toBe(403);
      const anonymous = await call(null, method, path, body);
      expect(anonymous.status, `${method} ${path}`).toBe(401);
    }

    expect(await auditActions()).toEqual([]);
    const [unchanged] = await db
      .select({ role: schema.userTable.role })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, admin.id));
    expect(unchanged?.role).toBe("admin");
  });

  it("re-checks the role in the database instead of trusting the session", async () => {
    // Session says admin, database says user (e.g. a cached session).
    const stale = { ...member, role: "admin" };
    mockSessions([stale]);
    const res = await call(stale, "GET", "/users");
    expect(res.status).toBe(403);
  });

  it("refuses admin API keys and the Better Auth admin HTTP endpoints", async () => {
    const { rawKey } = await insertApiKey(admin.id);
    const viaKey = await app.request("/api/admin/users", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });
    expect(viaKey.status).toBe(403);

    mockSessions([admin]);
    const direct = await app.request("/api/auth/admin/list-users", {
      headers: { "x-test-user": admin.id, Origin: origin },
    });
    expect(direct.status).toBe(403);
  });

  it("lists and filters users without exposing secrets", async () => {
    mockSessions([admin]);
    const all = await call(admin, "GET", "/users");
    expect(all.status).toBe(200);
    const body = (await all.json()) as {
      users: Record<string, unknown>[];
      total: number;
    };
    expect(body.total).toBe(2);
    expect(Object.keys(body.users[0] ?? {})).not.toContain("password");

    const admins = (await (
      await call(admin, "GET", "/users?role=admin")
    ).json()) as {
      users: { id: string }[];
    };
    expect(admins.users.map((user) => user.id)).toEqual([admin.id]);

    const search = (await (
      await call(
        admin,
        "GET",
        `/users?search=${encodeURIComponent(member.email)}`,
      )
    ).json()) as { users: { id: string }[] };
    expect(search.users.map((user) => user.id)).toEqual([member.id]);
  });

  it("creates a user who can sign in, and revoking the session invalidates it", async () => {
    const spy = mockSessions([admin]);
    const email = `new-${randomUUID()}@example.com`;
    const password = "correct-horse-battery";
    const created = await call(admin, "POST", "/users", {
      name: "New Person",
      email,
      password,
    });
    expect(created.status).toBe(200);
    const createdBody = (await created.json()) as {
      id: string;
      setupEmailSent: boolean;
    };
    expect(createdBody.setupEmailSent).toBe(false);

    const duplicate = await call(admin, "POST", "/users", {
      name: "Again",
      email,
    });
    expect(duplicate.status).toBe(409);

    spy.mockRestore();
    const signIn = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Origin: origin,
        Cookie: "csrf=1",
      },
      body: JSON.stringify({ email, password }),
    });
    expect(signIn.status).toBe(200);
    const token = signIn.headers.get("set-auth-token");
    expect(token).toBeTruthy();

    const getSession = () =>
      app.request("/api/auth/get-session", {
        headers: { Authorization: `Bearer ${token}`, Origin: origin },
      });
    expect(await (await getSession()).json()).toMatchObject({
      user: { email },
    });

    mockSessions([admin]);
    const sessions = (await (
      await call(admin, "GET", `/users/${createdBody.id}/sessions`)
    ).json()) as Record<string, unknown>[];
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).not.toHaveProperty("token");
    const sessionId = sessions[0]?.id as string;

    const wrongUser = await call(
      admin,
      "DELETE",
      `/users/${member.id}/sessions/${sessionId}`,
    );
    expect(wrongUser.status).toBe(404);

    const revoke = await call(
      admin,
      "DELETE",
      `/users/${createdBody.id}/sessions/${sessionId}`,
    );
    expect(revoke.status).toBe(200);
    vi.restoreAllMocks();

    expect(await (await getSession()).json()).toBeNull();
    expect(await auditActions()).toEqual(
      expect.arrayContaining(["user.created", "user.session_revoked"]),
    );
  });

  it("emails a setup link when no password is given and SMTP is configured", async () => {
    mockSessions([admin]);
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_PORT = "25";
    process.env.SMTP_FROM = "kaneo@example.com";
    try {
      const res = await call(admin, "POST", "/users", {
        name: "Invitee",
        email: `invitee-${randomUUID()}@example.com`,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ setupEmailSent: true });
      const tokens = await db.select().from(schema.verificationTable);
      expect(
        tokens.some((row) => row.identifier.startsWith("reset-password:")),
      ).toBe(true);
    } finally {
      process.env.SMTP_HOST = "";
      process.env.SMTP_PORT = "";
      process.env.SMTP_FROM = "";
    }
  });

  it("protects the acting admin and the last admin", async () => {
    const second = await createUser("admin");
    mockSessions([admin, second]);

    for (const [method, path, body] of [
      ["PATCH", `/users/${admin.id}/role`, { role: "user" }],
      ["POST", `/users/${admin.id}/ban`, {}],
      ["DELETE", `/users/${admin.id}`],
    ] as const) {
      const res = await call(admin, method, path, body);
      expect(res.status, `${method} ${path}`).toBe(400);
    }

    // Two admins demoting each other at once must not leave zero admins.
    const results = await Promise.all([
      call(admin, "PATCH", `/users/${second.id}/role`, { role: "user" }),
      call(second, "PATCH", `/users/${admin.id}/role`, { role: "user" }),
    ]);
    expect(results.map((res) => res.status).sort()).toEqual([200, 403]);

    const admins = await db
      .select({ id: schema.userTable.id })
      .from(schema.userTable)
      .where(eq(schema.userTable.role, "admin"));
    expect(admins).toHaveLength(1);
    expect(
      (await auditActions()).filter((a) => a === "user.role_changed"),
    ).toHaveLength(1);
  });

  it("bans, unbans and deletes users with audit entries", async () => {
    mockSessions([admin]);
    const { rawKey } = await insertApiKey(member.id);
    await db.insert(schema.sessionTable).values({
      id: `s-${randomUUID()}`,
      token: `t-${randomUUID()}`,
      userId: member.id,
      expiresAt: new Date(Date.now() + 3600_000),
      updatedAt: new Date(),
    });

    const keyRequest = () =>
      app.request("/api/notification", {
        headers: { Authorization: `Bearer ${rawKey}` },
      });
    expect((await keyRequest()).status).toBe(200);

    const ban = await call(admin, "POST", `/users/${member.id}/ban`, {
      reason: "spam",
    });
    expect(ban.status).toBe(200);
    expect(
      await db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, member.id)),
    ).toHaveLength(0);
    expect(
      (await call(admin, "POST", `/users/${member.id}/ban`, {})).status,
    ).toBe(409);

    vi.restoreAllMocks();
    expect((await keyRequest()).status).toBe(401);
    mockSessions([admin]);

    expect(
      (await call(admin, "POST", `/users/${member.id}/unban`)).status,
    ).toBe(200);

    const owner = await createUser("user");
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({
        name: "Owned",
        slug: `owned-${randomUUID()}`,
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: owner.id,
      role: "owner",
      joinedAt: new Date(),
    });
    expect((await call(admin, "DELETE", `/users/${owner.id}`)).status).toBe(
      409,
    );

    expect((await call(admin, "DELETE", `/users/${member.id}`)).status).toBe(
      200,
    );
    expect((await call(admin, "DELETE", `/users/${member.id}`)).status).toBe(
      404,
    );

    expect(await auditActions()).toEqual(
      expect.arrayContaining(["user.banned", "user.unbanned", "user.deleted"]),
    );
  });

  it("lists API keys by prefix only and revokes them with audit entries", async () => {
    mockSessions([admin]);
    const first = await insertApiKey(member.id);
    await insertApiKey(member.id);

    const list = (await (
      await call(admin, "GET", `/users/${member.id}/api-keys`)
    ).json()) as Record<string, unknown>[];
    expect(list).toHaveLength(2);
    for (const key of list) {
      expect(key).not.toHaveProperty("key");
      expect(JSON.stringify(key)).not.toContain(first.rawKey);
    }

    expect(
      (
        await call(
          admin,
          "DELETE",
          `/users/${member.id}/api-keys/${first.row.id}`,
        )
      ).status,
    ).toBe(200);
    const all = await call(admin, "DELETE", `/users/${member.id}/api-keys`);
    expect(await all.json()).toEqual({ revoked: 1 });

    expect(await auditActions()).toEqual(
      expect.arrayContaining(["user.api_key_revoked", "user.api_keys_revoked"]),
    );
  });

  it("pages and filters the append-only audit log", async () => {
    mockSessions([admin]);
    await call(admin, "PATCH", `/users/${member.id}/role`, { role: "admin" });
    await call(admin, "PATCH", `/users/${member.id}/role`, { role: "user" });
    await call(admin, "DELETE", `/users/${member.id}/sessions`);

    const page = (await (
      await call(admin, "GET", "/audit-log?limit=2&page=1")
    ).json()) as {
      entries: { action: string; actor: { id: string } }[];
      total: number;
    };
    expect(page.total).toBe(3);
    expect(page.entries).toHaveLength(2);
    expect(page.entries[0]?.actor.id).toBe(admin.id);

    const roleOnly = (await (
      await call(admin, "GET", "/audit-log?action=user.role_changed")
    ).json()) as { total: number };
    expect(roleOnly.total).toBe(2);

    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const res = await call(admin, method, "/audit-log");
      expect(res.status).toBe(404);
    }
  });
});
