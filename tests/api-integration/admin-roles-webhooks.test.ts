import { createHmac, randomUUID } from "node:crypto";
import type { Session, User } from "better-auth/types";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordAdminAction } from "../../apps/api/src/admin/audit/record-admin-action";
import { sendWebhookDelivery } from "../../apps/api/src/admin/webhooks/delivery";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import {
  instanceRoleAssignmentTable,
  instanceRoleTable,
  instanceWebhookDeliveryTable,
  instanceWebhookTable,
} from "../../apps/api/src/database/admin-schema";
import { createApp } from "../../apps/api/src/index";
import { encryptSecret } from "../../apps/api/src/notification-preferences/secrets";
import * as destinations from "../../apps/api/src/utils/assert-public-destination";
import * as outbound from "../../apps/api/src/utils/public-fetch";
import { resetTestDatabase } from "./helpers/database";

type UserRow = typeof schema.userTable.$inferSelect;
async function user(role = "user") {
  const id = randomUUID();
  return (
    await db
      .insert(schema.userTable)
      .values({
        id,
        name: role,
        email: `${id}@example.com`,
        role,
        emailVerified: true,
      })
      .returning()
  )[0];
}
describe("instance roles and signed audit webhooks", () => {
  let app: ReturnType<typeof createApp>["app"];
  let admin: UserRow;
  let support: UserRow;
  let member: UserRow;
  const call = (as: UserRow, method: string, path: string, body?: unknown) =>
    app.request(`/api/admin${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        "x-test-user": as.id,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  beforeEach(async () => {
    await resetTestDatabase();
    vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "integration-webhook-key");
    [admin, support, member] = await Promise.all([
      user("admin"),
      user(),
      user(),
    ]);
    const users = [admin, support, member];
    vi.spyOn(auth.api, "getSession").mockImplementation((async ({
      headers,
    }: {
      headers: Headers;
    }) => {
      const candidate = users.find(
        (entry) => entry.id === headers.get("x-test-user"),
      );
      if (!candidate) return null;
      const now = new Date();
      return {
        user: candidate as unknown as User,
        session: {
          id: `session-${candidate.id}`,
          token: "test",
          userId: candidate.id,
          createdAt: now,
          updatedAt: now,
          expiresAt: new Date(Date.now() + 3_600_000),
          ipAddress: null,
          userAgent: null,
        } as Session,
      };
    }) as typeof auth.api.getSession);
    app = createApp().app;
  });
  afterEach(() => vi.unstubAllEnvs());

  it("checks live custom permissions and prevents privilege escalation", async () => {
    expect((await call(support, "GET", "/users")).status).toBe(403);
    const created = await call(admin, "POST", "/roles", {
      name: "support",
      permissions: ["users:read", "users:manage", "users:create"],
    });
    expect(created.status).toBe(201);
    const role = await created.json();
    expect(
      (
        await call(admin, "PUT", `/users/${support.id}/instance-role`, {
          roleId: role.id,
        })
      ).status,
    ).toBe(200);
    expect((await call(support, "GET", "/users")).status).toBe(200);
    expect((await call(support, "GET", "/settings")).status).toBe(403);
    expect((await call(support, "GET", "/roles")).status).toBe(403);
    expect(
      (
        await call(support, "PATCH", `/users/${member.id}/role`, {
          role: "admin",
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(support, "POST", "/users", {
          name: "Malicious",
          email: "new-admin@example.com",
          role: "admin",
        })
      ).status,
    ).toBe(403);
    expect(
      (await call(support, "POST", `/users/${admin.id}/ban`, {})).status,
    ).toBe(403);
    const bannedAdmin = await user("admin");
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, bannedAdmin.id));
    expect(
      (await call(support, "POST", `/users/${bannedAdmin.id}/unban`)).status,
    ).toBe(403);
    const bannedCustom = await user();
    await db
      .insert(instanceRoleAssignmentTable)
      .values({ userId: bannedCustom.id, roleId: role.id });
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, bannedCustom.id));
    for (const target of [bannedAdmin, bannedCustom]) {
      expect(
        (await call(support, "POST", `/users/${target.id}/unban`)).status,
      ).toBe(403);
      expect(
        (await call(support, "POST", `/users/${target.id}/ban`, {})).status,
      ).toBe(403);
      expect(
        (await call(support, "DELETE", `/users/${target.id}`)).status,
      ).toBe(403);
    }
    expect((await call(admin, "DELETE", `/roles/${role.id}`)).status).toBe(409);
    expect(
      (await call(support, "POST", `/users/${member.id}/ban`, {})).status,
    ).toBe(200);
    await db
      .update(instanceRoleTable)
      .set({ permissions: [] })
      .where(eq(instanceRoleTable.id, role.id));
    expect((await call(support, "GET", "/users")).status).toBe(403);
    expect(
      (
        await call(admin, "POST", "/roles", {
          name: "evil",
          permissions: ["roles:manage"],
        })
      ).status,
    ).toBe(400);
  });

  it("revokes access when an assigned role is removed, regardless of cached session", async () => {
    const [role] = await db
      .insert(instanceRoleTable)
      .values({ name: "auditor", permissions: ["audit:read"] })
      .returning();
    await db
      .insert(instanceRoleAssignmentTable)
      .values({ userId: support.id, roleId: role.id });
    expect((await call(support, "GET", "/audit-log")).status).toBe(200);
    await db
      .delete(instanceRoleAssignmentTable)
      .where(eq(instanceRoleAssignmentTable.userId, support.id));
    expect((await call(support, "GET", "/audit-log")).status).toBe(403);
  });

  it("keeps custom permissions isolated across mounted admin routers", async () => {
    const [role] = await db
      .insert(instanceRoleTable)
      .values({
        name: "operator",
        permissions: ["instance:settings", "workspaces:read"],
      })
      .returning();
    await db
      .insert(instanceRoleAssignmentTable)
      .values({ userId: support.id, roleId: role.id });
    expect((await call(support, "GET", "/settings")).status).toBe(200);
    expect((await call(support, "GET", "/webhooks")).status).toBe(200);
    expect((await call(support, "GET", "/workspaces")).status).toBe(200);
    expect((await call(support, "GET", "/roles")).status).toBe(403);
    const access = await call(support, "GET", "/access");
    expect(access.status).toBe(200);
    expect((await access.json()).permissions).toContain("instance:settings");
    expect((await call(member, "GET", "/access")).status).toBe(200);
  });

  it("encrypts one-time secrets, rejects private destinations, and cancels queued deliveries", async () => {
    expect(
      (
        await call(admin, "POST", "/webhooks", {
          name: "Private",
          url: "http://127.0.0.1/test",
          categories: ["user"],
          enabled: true,
        })
      ).status,
    ).toBe(400);
    vi.spyOn(destinations, "assertPublicDestination").mockResolvedValue();
    const response = await call(admin, "POST", "/webhooks", {
      name: "Audit",
      url: "https://hooks.example.com/audit",
      categories: ["user"],
      enabled: true,
    });
    expect(response.status).toBe(201);
    const created = await response.json();
    expect(created.secret).toHaveLength(43);
    expect(created.webhook.signingSecret).toBeUndefined();
    const [stored] = await db.select().from(instanceWebhookTable);
    expect(stored.signingSecret).toMatch(/^enc:v1:/);
    expect(stored.signingSecret).not.toContain(created.secret);
    expect(
      JSON.stringify(await (await call(admin, "GET", "/webhooks")).json()),
    ).not.toContain(created.secret);
    await recordAdminAction(
      { actorUserId: admin.id, ipAddress: null, userAgent: null },
      { action: "user.test", targetType: "user", targetId: member.id },
    );
    expect(await db.select().from(instanceWebhookDeliveryTable)).toHaveLength(
      1,
    );
    expect(
      (
        await call(admin, "PUT", `/webhooks/${stored.id}`, {
          name: "Audit",
          url: stored.url,
          categories: ["user"],
          enabled: false,
        })
      ).status,
    ).toBe(200);
    expect(
      (await db.select().from(instanceWebhookDeliveryTable))[0].state,
    ).toBe("cancelled");
    expect(
      (await call(admin, "POST", `/webhooks/${stored.id}/test`)).status,
    ).toBe(409);
  });

  it("rolls queued delivery back with the audit transaction", async () => {
    await db.insert(instanceWebhookTable).values({
      name: "Audit",
      url: "https://hooks.example.com",
      signingSecret: encryptSecret("secret") as string,
      categories: ["user"],
    });
    await expect(
      db.transaction(async (tx) => {
        await recordAdminAction(
          { actorUserId: admin.id, ipAddress: null, userAgent: null },
          { action: "user.test", targetType: "user" },
          tx,
        );
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
    expect(await db.select().from(instanceWebhookDeliveryTable)).toHaveLength(
      0,
    );
  });

  it("claims each delivery once across workers and signs the exact outgoing bytes", async () => {
    const [webhook] = await db
      .insert(instanceWebhookTable)
      .values({
        name: "Audit",
        url: "https://hooks.example.com",
        signingSecret: encryptSecret("shared-secret") as string,
        categories: ["user"],
      })
      .returning();
    await db.insert(instanceWebhookDeliveryTable).values({
      webhookId: webhook.id,
      payload: { action: "user.test", text: "Tiếng Việt" },
    });
    vi.spyOn(destinations, "assertPublicDestination").mockResolvedValue();
    const send = vi
      .spyOn(outbound, "publicFetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));
    await Promise.all([sendWebhookDelivery(), sendWebhookDelivery()]);
    expect(send).toHaveBeenCalledTimes(1);
    const init = send.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers["x-kaneo-signature"]).toBe(
      `sha256=${createHmac("sha256", "shared-secret").update(`${headers["x-kaneo-timestamp"]}.${init.body}`).digest("hex")}`,
    );
    const [result] = await db.select().from(instanceWebhookDeliveryTable);
    expect(result.state).toBe("succeeded");
    expect(result.attempts).toBe(1);
  });
});
