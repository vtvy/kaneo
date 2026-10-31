import { and, desc, eq, gt } from "drizzle-orm";
import db, { schema } from "../../database";
import { findTargetUser } from "../users/find-target-user";

const session = schema.sessionTable;

/** Active sessions of a user. Tokens are never selected. */
export async function listUserSessions(
  userId: string,
  currentSessionId: string | null,
) {
  await findTargetUser(userId);
  const rows = await db
    .select({
      id: session.id,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      impersonatedBy: session.impersonatedBy,
    })
    .from(session)
    .where(and(eq(session.userId, userId), gt(session.expiresAt, new Date())))
    .orderBy(desc(session.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    lastActiveAt: row.updatedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    impersonated: Boolean(row.impersonatedBy),
    current: row.id === currentSessionId,
  }));
}

export default listUserSessions;
