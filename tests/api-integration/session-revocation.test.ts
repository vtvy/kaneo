import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  addConnection,
  initializeWebSocketAdapter,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { resetTestDatabase } from "./helpers/database";

const origin = "http://localhost:5173";

type App = ReturnType<typeof createApp>["app"];

function mergeCookieJar(jar: string, res: Response) {
  const pairs = (res.headers.getSetCookie?.() ?? [])
    .map((cookie) => cookie.split(";")[0])
    .filter(Boolean);
  return pairs.length ? `${jar}; ${pairs.join("; ")}` : jar;
}

async function signUp(app: App, label: string) {
  const email = `${label}-${randomUUID()}@example.com`;
  const password = "correct-horse-battery-staple";
  const headers = {
    "content-type": "application/json",
    Origin: origin,
    Cookie: "csrf=1",
    // Distinct client IPs keep Better Auth sign-up rate limits out of the way.
    "x-forwarded-for": `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
  };
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers,
    body: JSON.stringify({ name: label, email, password }),
  });
  expect(res.status).toBe(200);
  const jar = mergeCookieJar("csrf=1", res);
  const [user] = await db
    .select()
    .from(schema.userTable)
    .where(eq(schema.userTable.email, email));
  const [session] = await db
    .select({ id: schema.sessionTable.id })
    .from(schema.sessionTable)
    .where(eq(schema.sessionTable.userId, user.id));
  return { user, jar, sessionId: session.id };
}

function fakeSocket() {
  return { send: vi.fn(), close: vi.fn() } as never as {
    send: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

function watch(projectId: string, userId: string, sessionId: string) {
  const ws = fakeSocket();
  addConnection(projectId, ws as never, userId, userId, { sessionId });
  return ws;
}

describe("API integration: immediate session revocation", () => {
  let app: App;

  const request = (jar: string, method: string, path: string) =>
    app.request(path, { method, headers: { Origin: origin, Cookie: jar } });

  beforeEach(async () => {
    await resetTestDatabase();
    await initializeWebSocketAdapter();
    app = createApp().app;
  });

  afterEach(async () => {
    await shutdownWebSocketAdapter();
  });

  it("rejects a cookie and closes its sockets as soon as an admin revokes the session", async () => {
    // The first account on a fresh instance becomes the instance admin.
    const admin = await signUp(app, "admin");
    const member = await signUp(app, "member");
    const other = await signUp(app, "other");

    // Authenticated but not an admin.
    expect((await request(member.jar, "GET", "/api/admin/users")).status).toBe(
      403,
    );
    const revokedSocket = watch("p1", member.user.id, member.sessionId);
    const otherSessionSocket = watch("p1", member.user.id, "another-session");
    const otherUserSocket = watch("p1", other.user.id, other.sessionId);

    const revoke = await request(
      admin.jar,
      "DELETE",
      `/api/admin/users/${member.user.id}/sessions/${member.sessionId}`,
    );
    expect(revoke.status).toBe(200);

    // No cookie-cache window: the very next request is refused.
    expect((await request(member.jar, "GET", "/api/admin/users")).status).toBe(
      401,
    );
    expect(revokedSocket.close).toHaveBeenCalledWith(1008, "Session revoked");
    expect(otherSessionSocket.close).not.toHaveBeenCalled();
    expect(otherUserSocket.close).not.toHaveBeenCalled();
    expect((await request(other.jar, "GET", "/api/admin/users")).status).toBe(
      403,
    );
  });

  it("rejects a banned user's cookie immediately and closes all their sockets", async () => {
    const admin = await signUp(app, "admin");
    const member = await signUp(app, "member");
    const socketA = watch("p1", member.user.id, member.sessionId);
    const socketB = watch("p2", member.user.id, "api-session");

    const ban = await app.request(`/api/admin/users/${member.user.id}/ban`, {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: admin.jar,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(ban.status).toBe(200);

    expect((await request(member.jar, "GET", "/api/admin/users")).status).toBe(
      401,
    );
    expect(socketA.close).toHaveBeenCalled();
    expect(socketB.close).toHaveBeenCalled();
  });

  it("rejects a banned user even if their session row survived", async () => {
    await signUp(app, "admin");
    const member = await signUp(app, "member");
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, member.user.id));

    expect((await request(member.jar, "GET", "/api/admin/users")).status).toBe(
      401,
    );
  });

  it("closes a session's sockets when the user signs out", async () => {
    await signUp(app, "admin");
    const member = await signUp(app, "member");
    const socket = watch("p1", member.user.id, member.sessionId);

    const signOut = await app.request("/api/auth/sign-out", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: member.jar,
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });
    expect(signOut.status).toBe(200);
    await vi.waitFor(() =>
      expect(socket.close).toHaveBeenCalledWith(1008, "Session revoked"),
    );
    expect((await request(member.jar, "GET", "/api/admin/users")).status).toBe(
      401,
    );
  });
});
