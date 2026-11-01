import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";

async function profileSession(custom: boolean) {
  const id = randomUUID();
  const token = randomUUID();
  await db.insert(schema.userTable).values({
    id,
    name: "Provider name",
    email: `${id}@example.com`,
    emailVerified: true,
  });
  if (custom)
    await db
      .insert(schema.accountTable)
      .values({ userId: id, accountId: id, providerId: "custom" });
  await db.insert(schema.sessionTable).values({
    id: randomUUID(),
    userId: id,
    token,
    expiresAt: new Date(Date.now() + 60_000),
  });
  return { id, token };
}

function update(token: string, body: Record<string, unknown>) {
  return auth.handler(
    new Request("http://localhost:1337/api/auth/update-user", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
        origin: "http://localhost:5173",
      },
      body: JSON.stringify(body),
    }),
  );
}

describe("API integration: identity provider profile locks", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "name,image");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("rejects linked users editing managed fields while allowing locale changes", async () => {
    const { token } = await profileSession(true);
    expect((await update(token, { name: "Changed" })).status).toBe(403);
    expect(
      (await update(token, { image: "https://example.com/picture.png" }))
        .status,
    ).toBe(403);
    expect((await update(token, { locale: "vi-VN" })).status).toBe(200);
  });

  it("keeps local accounts editable and honors an empty managed field configuration", async () => {
    const local = await profileSession(false);
    expect((await update(local.token, { name: "Local name" })).status).toBe(
      200,
    );
    const custom = await profileSession(true);
    vi.stubEnv("CUSTOM_OAUTH_MANAGED_PROFILE_FIELDS", "");
    expect((await update(custom.token, { name: "Editable name" })).status).toBe(
      200,
    );
  });
});
