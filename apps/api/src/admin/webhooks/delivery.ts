import { createHmac } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import db from "../../database";
import {
  instanceWebhookDeliveryTable as delivery,
  instanceWebhookTable as webhook,
} from "../../database/admin-schema";
import { decryptSecret } from "../../notification-preferences/secrets";
import { assertPublicDestination } from "../../utils/assert-public-destination";
import { publicFetch } from "../../utils/public-fetch";
import type { DbOrTx } from "../audit/record-admin-action";

export const WEBHOOK_CATEGORIES = [
  "user",
  "session",
  "api_key",
  "workspace",
  "role",
  "instance",
  "email",
  "webhook",
] as const;
export function signWebhook(secret: string, timestamp: string, body: string) {
  return `sha256=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

/** Enqueue in the same transaction as the audit entry, visible after commit. */
export async function enqueueAuditWebhooks(database: DbOrTx, auditId: string) {
  await database.execute(sql`
    INSERT INTO instance_webhook_delivery (id, webhook_id, payload)
    SELECT gen_random_uuid()::text, w.id,
      jsonb_build_object('id', a.id, 'action', a.action, 'actorUserId', a.actor_user_id,
        'targetType', a.target_type, 'targetId', a.target_id, 'targetLabel', a.target_label,
        'metadata', a.metadata, 'createdAt', to_char(a.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
    FROM admin_audit_log a CROSS JOIN instance_webhook w
    WHERE a.id = ${auditId} AND w.enabled
      AND w.categories ? CASE
        WHEN a.action LIKE 'user.%session%' THEN 'session'
        WHEN a.action LIKE 'user.api_key%' THEN 'api_key'
        ELSE split_part(a.action, '.', 1) END
  `);
}

/** Row locks and a lease make claims safe across multiple instances. */
export async function sendWebhookDelivery() {
  const job = await db.transaction(async (tx) => {
    const rows = await tx
      .select({
        delivery,
        url: webhook.url,
        signingSecret: webhook.signingSecret,
      })
      .from(delivery)
      .innerJoin(webhook, eq(delivery.webhookId, webhook.id))
      .where(
        and(
          eq(delivery.state, "pending"),
          eq(webhook.enabled, true),
          sql`${delivery.nextAttemptAt} <= now()`,
        ),
      )
      .orderBy(delivery.createdAt)
      .limit(1)
      .for("update", { of: delivery, skipLocked: true });
    const job = rows[0];
    if (!job) return null;
    const [claimed] = await tx
      .update(delivery)
      .set({
        attempts: sql`${delivery.attempts} + 1`,
        nextAttemptAt: sql`now() + interval '60 seconds'`,
      })
      .where(eq(delivery.id, job.delivery.id))
      .returning();
    if (!claimed) return null;
    return { ...job, delivery: claimed };
  });
  if (!job) return false;
  let statusCode: number | null = null;
  let errorCode: string | null = null;
  let retryable = false;
  try {
    const [active] = await db
      .select({ enabled: webhook.enabled })
      .from(delivery)
      .innerJoin(webhook, eq(delivery.webhookId, webhook.id))
      .where(
        and(
          eq(delivery.id, job.delivery.id),
          eq(delivery.state, "pending"),
          eq(delivery.attempts, job.delivery.attempts),
          eq(webhook.url, job.url),
          eq(webhook.signingSecret, job.signingSecret),
        ),
      );
    if (!active?.enabled) return true;
    await assertPublicDestination(job.url, "Instance webhook");
    const secret = decryptSecret(job.signingSecret);
    if (!secret) throw new Error("Missing signing secret");
    const body = JSON.stringify(job.delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const response = await publicFetch(job.url, {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
      body,
      headers: {
        "content-type": "application/json",
        "x-kaneo-timestamp": timestamp,
        "x-kaneo-signature": signWebhook(secret, timestamp, body),
        "x-kaneo-delivery": job.delivery.id,
      },
    });
    statusCode = response.status;
    // Response bodies can contain secrets or be unbounded: never retain them.
    await response.body?.cancel();
    if (!response.ok) {
      errorCode = "http";
      retryable =
        response.status === 408 ||
        response.status === 429 ||
        response.status >= 500;
    }
  } catch {
    errorCode = "network_or_signing";
    retryable = true;
  }
  const retry = errorCode !== null && retryable && job.delivery.attempts < 3;
  await db.transaction(async (tx) => {
    await tx
      .update(delivery)
      .set({
        state: retry ? "pending" : errorCode ? "failed" : "succeeded",
        statusCode,
        errorCode,
        deliveredAt: retry ? null : new Date(),
        nextAttemptAt: sql`now() + interval '30 seconds'`,
      })
      .where(
        and(
          eq(delivery.id, job.delivery.id),
          eq(delivery.state, "pending"),
          eq(delivery.attempts, job.delivery.attempts),
        ),
      );
    const keep = await tx
      .select({ id: delivery.id })
      .from(delivery)
      .where(
        and(
          eq(delivery.webhookId, job.delivery.webhookId),
          sql`${delivery.state} != 'pending'`,
        ),
      )
      .orderBy(desc(delivery.createdAt))
      .limit(100);
    const oldest = keep[99];
    if (oldest)
      await tx
        .delete(delivery)
        .where(
          and(
            eq(delivery.webhookId, job.delivery.webhookId),
            sql`${delivery.state} != 'pending'`,
            sql`${delivery.createdAt} < (SELECT created_at FROM instance_webhook_delivery WHERE id = ${oldest.id})`,
          ),
        );
  });
  return true;
}

export function startInstanceWebhookWorker() {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      for (let i = 0; i < 20 && (await sendWebhookDelivery()); i++) {
        /* bounded batch */
      }
    } catch (error) {
      console.error(
        "Instance webhook worker failed",
        error instanceof Error ? error.name : "unknown",
      );
    } finally {
      running = false;
    }
  }, 1_000);
  timer.unref();
  return () => clearInterval(timer);
}
