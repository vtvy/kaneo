import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import {
  assertAdminRemovable,
  assertNotSelf,
  lockAdminChanges,
} from "../users/admin-guards";
import { findTargetUser } from "../users/find-target-user";
import { isBanActive } from "../users/is-ban-active";

export async function banUser(
  request: AdminAuditRequest,
  userId: string,
  input: { reason?: string; expiresAt?: string },
) {
  assertNotSelf(request.actorUserId, userId);

  const banExpires = input.expiresAt ? new Date(input.expiresAt) : null;
  if (banExpires && banExpires.getTime() <= Date.now()) {
    throw new HTTPException(400, {
      message: "Ban expiry must be in the future",
    });
  }

  return db.transaction(async (tx) => {
    await lockAdminChanges(tx);
    const target = await findTargetUser(userId, tx, { forUpdate: true });
    if (isBanActive(target)) {
      throw new HTTPException(409, { message: "User is already banned" });
    }
    // A banned admin cannot act, so banning the last one locks everyone out.
    await assertAdminRemovable(tx, request.actorUserId, target);

    const banReason = input.reason?.trim() || null;
    await tx
      .update(schema.userTable)
      .set({ banned: true, banReason, banExpires })
      .where(eq(schema.userTable.id, target.id));
    const revoked = await tx
      .delete(schema.sessionTable)
      .where(eq(schema.sessionTable.userId, target.id))
      .returning({ id: schema.sessionTable.id });

    await recordAdminAction(
      request,
      {
        action: "user.banned",
        targetType: "user",
        targetId: target.id,
        targetLabel: target.email,
        metadata: {
          reason: banReason,
          expiresAt: banExpires,
          sessionsRevoked: revoked.length,
        },
      },
      tx,
    );

    return { id: target.id, banned: true };
  });
}

export default banUser;
