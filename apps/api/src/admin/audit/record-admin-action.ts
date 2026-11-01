import { sql } from "drizzle-orm";
import db, { schema } from "../../database";
import { enqueueAuditWebhooks } from "../webhooks/delivery";
import type { AdminAuditRequest } from "./admin-audit-request";
import { sanitizeAuditMetadata } from "./sanitize-audit-metadata";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type DbOrTx = Database | Transaction;

export type AdminActionInput = {
  /** Dotted `<area>.<verb>` name, for example `user.deleted`. */
  action: string;
  targetType: string;
  targetId?: string | null;
  targetLabel?: string | null;
  /** Never put secrets, tokens, reset links, or key values here. */
  metadata?: Record<string, unknown> | null;
};

/**
 * Append an entry to the admin audit log. Pass the transaction when the action
 * has one so the entry commits (or rolls back) with it. Entries are never
 * updated or deleted.
 */
export async function recordAdminAction(
  request: AdminAuditRequest,
  input: AdminActionInput,
  database: DbOrTx = db,
): Promise<void> {
  if (database === db) {
    await db.transaction((tx) => recordAdminAction(request, input, tx));
    return;
  }
  const actorId = request.actorUserId;
  // Resolved in the insert so a concurrently deleted actor yields NULL
  // instead of a foreign key error.
  const actor = (column: "id" | "name" | "email") =>
    sql`(SELECT ${sql.identifier(column)} FROM "user" WHERE "id" = ${actorId})`;

  const [entry] = await database
    .insert(schema.adminAuditLogTable)
    .values({
      actorUserId: actor("id"),
      actorName: actor("name"),
      actorEmail: actor("email"),
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId ?? null,
      targetLabel: input.targetLabel ?? null,
      metadata: input.metadata
        ? (sanitizeAuditMetadata(input.metadata) as Record<string, unknown>)
        : null,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    })
    .returning({ id: schema.adminAuditLogTable.id });
  if (!entry) throw new Error("Failed to record administration action");
  await enqueueAuditWebhooks(database, entry.id);
}

export default recordAdminAction;
