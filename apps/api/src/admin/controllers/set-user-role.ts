import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { instanceRoleAssignmentTable } from "../../database/admin-schema";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import {
  assertAdminRemovable,
  assertNotSelf,
  lockAdminChanges,
} from "../users/admin-guards";
import { findTargetUser } from "../users/find-target-user";

export async function setUserRole(
  request: AdminAuditRequest,
  userId: string,
  role: "admin" | "user",
) {
  assertNotSelf(request.actorUserId, userId);

  return db.transaction(async (tx) => {
    await lockAdminChanges(tx);
    const target = await findTargetUser(userId, tx, { forUpdate: true });
    const previousRole = target.role === "admin" ? "admin" : "user";
    if (previousRole === role) {
      return { id: target.id, role, changed: false };
    }

    if (role !== "admin") {
      await assertAdminRemovable(tx, request.actorUserId, target);
    }

    await tx
      .update(schema.userTable)
      .set({ role })
      .where(eq(schema.userTable.id, target.id));
    await tx
      .delete(instanceRoleAssignmentTable)
      .where(eq(instanceRoleAssignmentTable.userId, target.id));

    await recordAdminAction(
      request,
      {
        action: "user.role_changed",
        targetType: "user",
        targetId: target.id,
        targetLabel: target.email,
        metadata: { from: previousRole, to: role },
      },
      tx,
    );

    return { id: target.id, role, changed: true };
  });
}

export default setUserRole;
