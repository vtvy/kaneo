import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  CUSTOM_OAUTH_CALLBACK_URL,
  signInWithCustomOAuth,
} from "./helpers/custom-oauth";
import { resetTestDatabase } from "./helpers/database";
import {
  enableBackchannelLogout,
  postLogoutToken,
  signLogoutToken,
} from "./helpers/logout-token";

vi.hoisted(() => {
  process.env.CUSTOM_OAUTH_CLIENT_ID = "kaneo-test";
  process.env.CUSTOM_OAUTH_CLIENT_SECRET = "kaneo-test-secret";
  process.env.CUSTOM_OAUTH_AUTHORIZATION_URL =
    "https://idp.example.com/authorize";
  process.env.CUSTOM_OAUTH_TOKEN_URL = "https://idp.example.com/token";
  process.env.CUSTOM_OAUTH_SCOPES = "openid,profile,email";
});

type App = ReturnType<typeof createApp>["app"];

function claims(sid?: string) {
  return {
    sub: "kc-user-1",
    email: "jane@example.com",
    email_verified: true,
    name: "Jane Provider",
    sid,
  };
}

async function signIn(app: App, sid?: string) {
  const response = await signInWithCustomOAuth(app, claims(sid));
  expect(response.status).toBe(302);
  return response;
}

async function storedSessionIds() {
  const sessions = await db
    .select({ oidcSid: schema.sessionTable.oidcSid })
    .from(schema.sessionTable);
  return sessions.map((session) => session.oidcSid);
}

describe("API integration: back-channel logout after a sign-in", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("stores the provider session ID of every sign-in on its session", async () => {
    const { app } = createApp();
    await signIn(app, "kc-session-1");
    await signIn(app, "kc-session-2");
    await signIn(app);

    expect((await storedSessionIds()).sort()).toEqual([
      "kc-session-1",
      "kc-session-2",
      null,
    ]);
    const accounts = await db
      .select({
        providerId: schema.accountTable.providerId,
        accountId: schema.accountTable.accountId,
      })
      .from(schema.accountTable);
    expect(accounts).toEqual([
      { providerId: "custom", accountId: "kc-user-1" },
    ]);
  });

  it("stores the provider session ID when the first sign-in links a local account", async () => {
    const [user] = await db
      .insert(schema.userTable)
      .values({
        id: `user-${randomUUID()}`,
        email: "jane@example.com",
        emailVerified: true,
        name: "Jane Local",
      })
      .returning({ id: schema.userTable.id });
    if (!user) throw new Error("Failed to seed user");
    const { app } = createApp();

    const response = await signIn(app, "kc-session-1");

    expect(response.headers.get("location")).toBe(CUSTOM_OAUTH_CALLBACK_URL);
    const sessions = await db
      .select({
        userId: schema.sessionTable.userId,
        oidcSid: schema.sessionTable.oidcSid,
      })
      .from(schema.sessionTable);
    expect(sessions).toEqual([{ userId: user.id, oidcSid: "kc-session-1" }]);
    const accounts = await db
      .select({
        providerId: schema.accountTable.providerId,
        accountId: schema.accountTable.accountId,
        userId: schema.accountTable.userId,
      })
      .from(schema.accountTable);
    expect(accounts).toEqual([
      { providerId: "custom", accountId: "kc-user-1", userId: user.id },
    ]);
  });

  it("keeps the provider session ID out of session responses", async () => {
    const { app } = createApp();
    const response = await signIn(app, "kc-session-1");
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");

    const session = await app.request("/api/auth/get-session", {
      headers: { cookie },
    });

    expect(session.status).toBe(200);
    const body = (await session.json()) as { session?: object } | null;
    expect(body?.session).toBeDefined();
    expect(body?.session).not.toHaveProperty("oidcSid");
  });

  it("ends only the session that started from the logged-out provider session", async () => {
    const { app } = createApp();
    await signIn(app, "kc-session-1");
    await signIn(app, "kc-session-2");
    const { issuer } = enableBackchannelLogout();

    const response = await postLogoutToken(
      app,
      signLogoutToken(issuer, { sub: "kc-user-1", sid: "kc-session-1" }),
    );

    expect(response.status).toBe(200);
    expect(await storedSessionIds()).toEqual(["kc-session-2"]);
  });

  it("syncs managed profile fields onto the linked user at every sign-in", async () => {
    vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,image");
    const { app } = createApp();
    await signIn(app, "kc-session-1");
    await db
      .update(schema.userTable)
      .set({ name: "Edited In Kaneo" })
      .where(eq(schema.userTable.email, "jane@example.com"));

    const response = await signInWithCustomOAuth(app, {
      ...claims("kc-session-2"),
      name: "Jane Renamed",
      email: "jane@example.com",
      picture: "https://cdn.example.com/jane.png",
    });

    expect(response.status).toBe(302);
    const users = await db
      .select({
        name: schema.userTable.name,
        image: schema.userTable.image,
        email: schema.userTable.email,
      })
      .from(schema.userTable);
    expect(users).toEqual([
      {
        name: "Jane Renamed",
        image: "https://cdn.example.com/jane.png",
        email: "jane@example.com",
      },
    ]);
  });

  it("leaves profiles alone without managed profile fields", async () => {
    const { app } = createApp();
    await signIn(app, "kc-session-1");
    await db
      .update(schema.userTable)
      .set({ name: "Edited In Kaneo" })
      .where(eq(schema.userTable.email, "jane@example.com"));

    await signIn(app, "kc-session-2");

    const [user] = await db
      .select({ name: schema.userTable.name })
      .from(schema.userTable);
    expect(user?.name).toBe("Edited In Kaneo");
  });
});
