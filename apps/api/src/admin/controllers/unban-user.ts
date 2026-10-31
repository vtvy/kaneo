import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findTargetUser } from "../users/find-target-user";
import { isBanActive } from "../users/is-ban-active";

export async function unbanUser(request: AdminAuditRequest, userId: string) {
  return db.transaction(async (tx) => {
    const target = await findTargetUser(userId, tx, { forUpdate: true });
    if (!isBanActive(target)) {
      throw new HTTPException(409, { message: "User is not banned" });
    }

    await tx
      .update(schema.userTable)
      .set({ banned: false, banReason: null, banExpires: null })
      .where(eq(schema.userTable.id, target.id));

    await recordAdminAction(
      request,
      {
        action: "user.unbanned",
        targetType: "user",
        targetId: target.id,
        targetLabel: target.email,
      },
      tx,
    );

    return { id: target.id, banned: false };
  });
}

export default unbanUser;
