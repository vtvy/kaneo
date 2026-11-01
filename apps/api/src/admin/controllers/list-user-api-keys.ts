import { desc, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { findTargetUser } from "../users/find-target-user";

const apikey = schema.apikeyTable;

/** API keys of a user, identified by name and visible prefix only. */
export async function listUserApiKeys(userId: string) {
  await findTargetUser(userId);
  const rows = await db
    .select({
      id: apikey.id,
      name: apikey.name,
      start: apikey.start,
      prefix: apikey.prefix,
      enabled: apikey.enabled,
      expiresAt: apikey.expiresAt,
      lastRequest: apikey.lastRequest,
      createdAt: apikey.createdAt,
    })
    .from(apikey)
    .where(eq(apikey.referenceId, userId))
    .orderBy(desc(apikey.createdAt));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    start: row.start,
    prefix: row.prefix,
    enabled: row.enabled ?? false,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastRequest?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

export default listUserApiKeys;
