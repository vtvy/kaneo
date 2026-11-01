import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";
import {
  enableBackchannelLogout,
  postLogoutToken,
  signLogoutToken,
} from "./helpers/logout-token";

async function seedUser(accountId?: string, providerId = "custom") {
  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: `user-${randomUUID()}`,
      email: `${randomUUID()}@example.com`,
      emailVerified: true,
      name: "Provider User",
    })
    .returning();
  if (!user) throw new Error("Failed to seed user");
  if (accountId) {
    await db.insert(schema.accountTable).values({
      accountId,
      providerId,
      userId: user.id,
    });
  }
  return user;
}

async function seedSession(userId: string, oidcSid: string | null = null) {
  const id = randomUUID();
  await db.insert(schema.sessionTable).values({
    id,
    userId,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 60_000),
    oidcSid,
  });
  return id;
}

async function remainingSessionIds() {
  const sessions = await db
    .select({ id: schema.sessionTable.id })
    .from(schema.sessionTable);
  return sessions.map((session) => session.id).sort();
}

describe("API integration: back-channel logout", () => {
  let issuer: string;

  beforeEach(async () => {
    await resetTestDatabase();
    ({ issuer } = enableBackchannelLogout());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("ends the sessions with the provider session ID and leaves others", async () => {
    const user = await seedUser("kc-user-1");
    const other = await seedUser("kc-user-2");
    await seedSession(user.id, "kc-session-1");
    await seedSession(other.id, "kc-session-1");
    const otherSid = await seedSession(user.id, "kc-session-2");
    const withoutSid = await seedSession(user.id);

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sid: "kc-session-1" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(await remainingSessionIds()).toEqual([otherSid, withoutSid].sort());
  });

  it("limits a sid to the subject's sessions when both are sent", async () => {
    const user = await seedUser("kc-user-1");
    const other = await seedUser("kc-user-2");
    await seedSession(user.id, "kc-session-1");
    const otherUser = await seedSession(other.id, "kc-session-1");

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "kc-user-1", sid: "kc-session-1" }),
    );

    expect(response.status).toBe(200);
    expect(await remainingSessionIds()).toEqual([otherUser]);
  });

  it("ends every session of the subject's custom account only", async () => {
    const user = await seedUser("12345");
    const githubUser = await seedUser("12345", "github");
    await seedSession(user.id, "kc-session-1");
    await seedSession(user.id);
    const kept = await seedSession(githubUser.id);

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "12345" }),
    );

    expect(response.status).toBe(200);
    expect(await remainingSessionIds()).toEqual([kept]);
  });

  it("refuses a replayed logout token", async () => {
    const user = await seedUser("kc-user-1");
    await seedSession(user.id, "kc-session-1");
    const jti = randomUUID();
    const token = signLogoutToken(issuer, { sub: "kc-user-1", jti });
    const { app } = createApp();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect((await postLogoutToken(app, token)).status).toBe(200);
    const replay = await postLogoutToken(app, token);

    expect(replay.status).toBe(400);
    expect(replay.headers.get("cache-control")).toBe("no-store");
    expect(await replay.json()).toEqual({ error: "invalid_request" });
    const used = await db
      .select()
      .from(schema.verificationTable)
      .where(
        eq(
          schema.verificationTable.identifier,
          `backchannel-logout:${issuer}:${jti}`,
        ),
      );
    expect(used).toHaveLength(1);
  });

  it.each([
    ["another audience", { aud: "other-client" }],
    ["another issuer", { iss: "https://evil.example.com" }],
    ["a nonce", { nonce: "n-1" }],
    ["no logout event", { events: {} }],
  ])("answers 400 for a token with %s and ends nothing", async (_name, claims) => {
    const user = await seedUser("kc-user-1");
    const kept = await seedSession(user.id, "kc-session-1");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sid: "kc-session-1", ...claims }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
    expect(await remainingSessionIds()).toEqual([kept]);
    expect(await db.select().from(schema.verificationTable)).toHaveLength(0);
  });

  it("answers 400 for a request without a logout token", async () => {
    const response = await createApp().app.request(
      "/api/auth/oauth2/backchannel-logout/custom",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: "logout_token=not-a-jwt",
      },
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers 404 while back-channel logout is off", async () => {
    vi.stubEnv("CUSTOM_OAUTH_BACKCHANNEL_LOGOUT", "");

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "kc-user-1" }),
    );

    expect(response.status).toBe(404);
  });

  it("answers 503 while the discovery document cannot be loaded", async () => {
    const user = await seedUser("kc-user-1");
    const kept = await seedSession(user.id, "kc-session-1");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 500 })),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await postLogoutToken(
      createApp().app,
      signLogoutToken(issuer, { sub: "kc-user-1" }),
    );

    expect(response.status).toBe(503);
    expect(await remainingSessionIds()).toEqual([kept]);
  });
});
