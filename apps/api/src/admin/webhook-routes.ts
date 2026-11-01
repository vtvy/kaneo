import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import db from "../database";
import {
  instanceWebhookDeliveryTable as delivery,
  instanceWebhookTable as webhook,
} from "../database/admin-schema";
import { encryptSecret } from "../notification-preferences/secrets";
import { assertPublicDestination } from "../utils/assert-public-destination";
import { adminAuditRequest } from "./audit/admin-audit-request";
import { recordAdminAction } from "./audit/record-admin-action";
import { WEBHOOK_CATEGORIES } from "./webhooks/delivery";

const webhookInput = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100)),
  url: v.pipe(v.string(), v.url(), v.maxLength(2048)),
  categories: v.pipe(
    v.array(v.picklist(WEBHOOK_CATEGORIES)),
    v.minLength(1),
    v.maxLength(WEBHOOK_CATEGORIES.length),
  ),
  enabled: v.boolean(),
});
const param = v.object({ webhookId: v.pipe(v.string(), v.minLength(1)) });
const info = (operationId: string) =>
  describeRoute({
    operationId,
    tags: ["Admin"],
    description:
      "Manage signed instance audit webhooks; requires instance:settings",
  });
function publicWebhook(row: typeof webhook.$inferSelect) {
  const { signingSecret: _secret, ...publicRow } = row;
  return publicRow;
}
async function validateUrl(url: string) {
  const parsed = new URL(url);
  if (parsed.username || parsed.password)
    throw new HTTPException(400, {
      message: "Webhook URLs cannot contain credentials",
    });
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:")
    throw new HTTPException(400, {
      message: "Webhooks require HTTPS in production",
    });
  try {
    await assertPublicDestination(url, "Instance webhook");
  } catch {
    throw new HTTPException(400, {
      message: "Webhook URL must resolve to a public HTTP(S) destination",
    });
  }
}
function newSecret() {
  if (!process.env.NOTIFICATION_SECRET_ENCRYPTION_KEY?.trim())
    throw new HTTPException(409, {
      message:
        "Set NOTIFICATION_SECRET_ENCRYPTION_KEY before creating webhooks",
    });
  const secret = randomBytes(32).toString("base64url");
  return { secret, encrypted: encryptSecret(secret) as string };
}
async function requireWebhook(id: string) {
  const [row] = await db.select().from(webhook).where(eq(webhook.id, id));
  if (!row) throw new HTTPException(404, { message: "Webhook not found" });
  return row;
}

const webhooks = new Hono<{
  Variables: { userId: string; apiKey?: { id: string } };
}>()
  .get("/webhooks", info("adminListInstanceWebhooks"), async (c) =>
    c.json({
      webhooks: (await db.select().from(webhook).orderBy(webhook.name)).map(
        publicWebhook,
      ),
      categories: WEBHOOK_CATEGORIES,
    }),
  )
  .post(
    "/webhooks",
    info("adminCreateInstanceWebhook"),
    validator("json", webhookInput),
    async (c) => {
      const input = c.req.valid("json");
      await validateUrl(input.url);
      const { secret, encrypted } = newSecret();
      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(webhook)
          .values({
            ...input,
            categories: [...new Set(input.categories)],
            signingSecret: encrypted,
          })
          .returning();
        if (!row) throw new Error("Failed to create webhook");
        await recordAdminAction(
          adminAuditRequest(c),
          {
            action: "webhook.created",
            targetType: "instance_webhook",
            targetId: row.id,
            targetLabel: row.name,
          },
          tx,
        );
        return row;
      });
      return c.json({ webhook: publicWebhook(created), secret }, 201);
    },
  )
  .put(
    "/webhooks/:webhookId",
    info("adminUpdateInstanceWebhook"),
    validator("param", param),
    validator("json", webhookInput),
    async (c) => {
      const { webhookId } = c.req.valid("param");
      const input = c.req.valid("json");
      await validateUrl(input.url);
      await requireWebhook(webhookId);
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(webhook)
          .set({ ...input, categories: [...new Set(input.categories)] })
          .where(eq(webhook.id, webhookId))
          .returning();
        if (!row)
          throw new HTTPException(404, { message: "Webhook not found" });
        // Configuration changes cancel old queued payloads, so re-enable cannot revive them.
        await tx
          .update(delivery)
          .set({ state: "cancelled" })
          .where(
            and(
              eq(delivery.webhookId, webhookId),
              eq(delivery.state, "pending"),
            ),
          );
        await recordAdminAction(
          adminAuditRequest(c),
          {
            action: "webhook.updated",
            targetType: "instance_webhook",
            targetId: webhookId,
            targetLabel: input.name,
          },
          tx,
        );
        return row;
      });
      return c.json(publicWebhook(updated));
    },
  )
  .delete(
    "/webhooks/:webhookId",
    info("adminDeleteInstanceWebhook"),
    validator("param", param),
    async (c) => {
      const { webhookId } = c.req.valid("param");
      const existing = await requireWebhook(webhookId);
      await db.transaction(async (tx) => {
        await tx.delete(webhook).where(eq(webhook.id, webhookId));
        await recordAdminAction(
          adminAuditRequest(c),
          {
            action: "webhook.deleted",
            targetType: "instance_webhook",
            targetId: webhookId,
            targetLabel: existing.name,
          },
          tx,
        );
      });
      return c.json({ id: webhookId });
    },
  )
  .post(
    "/webhooks/:webhookId/rotate-secret",
    info("adminRotateInstanceWebhookSecret"),
    validator("param", param),
    async (c) => {
      const { webhookId } = c.req.valid("param");
      await requireWebhook(webhookId);
      const { secret, encrypted } = newSecret();
      const updated = await db.transaction(async (tx) => {
        const [row] = await tx
          .update(webhook)
          .set({ signingSecret: encrypted })
          .where(eq(webhook.id, webhookId))
          .returning();
        if (!row)
          throw new HTTPException(404, { message: "Webhook not found" });
        await tx
          .update(delivery)
          .set({ state: "cancelled" })
          .where(
            and(
              eq(delivery.webhookId, webhookId),
              eq(delivery.state, "pending"),
            ),
          );
        await recordAdminAction(
          adminAuditRequest(c),
          {
            action: "webhook.secret_rotated",
            targetType: "instance_webhook",
            targetId: webhookId,
          },
          tx,
        );
        return row;
      });
      return c.json({ webhook: publicWebhook(updated), secret });
    },
  )
  .post(
    "/webhooks/:webhookId/test",
    info("adminTestInstanceWebhook"),
    validator("param", param),
    async (c) => {
      const { webhookId } = c.req.valid("param");
      const row = await requireWebhook(webhookId);
      if (!row.enabled)
        throw new HTTPException(409, { message: "Webhook is disabled" });
      const result = await db.transaction(async (tx) => {
        const [queued] = await tx
          .insert(delivery)
          .values({
            webhookId,
            payload: {
              action: "webhook.test",
              createdAt: new Date().toISOString(),
            },
          })
          .returning({ id: delivery.id });
        await recordAdminAction(
          adminAuditRequest(c),
          {
            action: "webhook.tested",
            targetType: "instance_webhook",
            targetId: webhookId,
          },
          tx,
        );
        return queued;
      });
      return c.json(result, 202);
    },
  )
  .get(
    "/webhooks/:webhookId/deliveries",
    info("adminListInstanceWebhookDeliveries"),
    validator("param", param),
    async (c) => {
      const { webhookId } = c.req.valid("param");
      await requireWebhook(webhookId);
      return c.json(
        await db
          .select({
            id: delivery.id,
            state: delivery.state,
            attempts: delivery.attempts,
            statusCode: delivery.statusCode,
            errorCode: delivery.errorCode,
            createdAt: delivery.createdAt,
            deliveredAt: delivery.deliveredAt,
          })
          .from(delivery)
          .where(eq(delivery.webhookId, webhookId))
          .orderBy(desc(delivery.createdAt))
          .limit(20),
      );
    },
  );
export default webhooks;
