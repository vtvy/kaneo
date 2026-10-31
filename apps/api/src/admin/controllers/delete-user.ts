import { and, count, eq } from "drizzle-orm";
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

export async function deleteUser(request: AdminAuditRequest, userId: string) {
  assertNotSelf(request.actorUserId, userId);

  return db.transaction(async (tx) => {
    await lockAdminChanges(tx);
    const target = await findTargetUser(userId, tx, { forUpdate: true });
    await assertAdminRemovable(tx, request.actorUserId, target);

    // Deleting an owner would orphan their workspaces.
    const [owned] = await tx
      .select({ value: count() })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.userId, target.id),
          eq(schema.workspaceUserTable.role, "owner"),
        ),
      );
    if ((owned?.value ?? 0) > 0) {
      throw new HTTPException(409, {
        message:
          "This user owns workspaces. Transfer ownership before deleting the account.",
      });
    }

    // Audit first: the entry snapshots the target, and the actor FK is
    // unaffected by deleting a different user.
    await recordAdminAction(
      request,
      {
        action: "user.deleted",
        targetType: "user",
        targetId: target.id,
        targetLabel: target.email,
        metadata: { name: target.name, role: target.role ?? "user" },
      },
      tx,
    );

    await tx.delete(schema.userTable).where(eq(schema.userTable.id, target.id));

    return { id: target.id, deleted: true };
  });
}

export default deleteUser;
