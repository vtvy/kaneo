import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findTargetUser } from "../users/find-target-user";

const session = schema.sessionTable;

/** Revokes one session (when `sessionId` is set) or every session of a user. */
export async function revokeUserSessions(
  request: AdminAuditRequest,
  userId: string,
  sessionId?: string,
) {
  return db.transaction(async (tx) => {
    const target = await findTargetUser(userId, tx);
    const revoked = await tx
      .delete(session)
      .where(
        sessionId
          ? and(eq(session.userId, target.id), eq(session.id, sessionId))
          : eq(session.userId, target.id),
      )
      .returning({ id: session.id });

    if (sessionId && revoked.length === 0) {
      throw new HTTPException(404, { message: "Session not found" });
    }

    await recordAdminAction(
      request,
      {
        action: sessionId ? "user.session_revoked" : "user.sessions_revoked",
        targetType: "user",
        targetId: target.id,
        targetLabel: target.email,
        metadata: sessionId ? { sessionId } : { count: revoked.length },
      },
      tx,
    );

    return { revoked: revoked.length };
  });
}

export default revokeUserSessions;
