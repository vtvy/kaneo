import { and, count, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "../../database";
import type { DbOrTx } from "../audit/record-admin-action";
import {
  getInstanceAccess,
  hasInstancePrivileges,
} from "../roles/get-instance-access";

// Serializes every change that can remove an administrator, so two admins
// demoting each other concurrently cannot leave the instance without one.
const ADMIN_CHANGE_LOCK = 2027;

const user = schema.userTable;

export function assertNotSelf(actorId: string, targetId: string) {
  if (actorId === targetId) {
    throw new HTTPException(400, {
      message: "You cannot perform this action on your own account",
    });
  }
}

export async function lockAdminChanges(tx: DbOrTx) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(${ADMIN_CHANGE_LOCK})`);
}

/** Active (not banned) administrators other than `excludeUserId`. */
async function countOtherActiveAdmins(tx: DbOrTx, excludeUserId: string) {
  const [row] = await tx
    .select({ value: count() })
    .from(user)
    .where(
      and(
        eq(user.role, "admin"),
        ne(user.id, excludeUserId),
        or(
          isNull(user.banned),
          eq(user.banned, false),
          lte(user.banExpires, new Date()),
        ),
      ),
    );
  return row?.value ?? 0;
}

/**
 * Must run inside the transaction holding `lockAdminChanges`. Re-checks the
 * actor is still an admin and refuses to remove the last active admin.
 */
export async function assertAdminRemovable(
  tx: DbOrTx,
  actorId: string,
  target: { id: string; role: string | null },
) {
  const actor = await getInstanceAccess(actorId, tx);
  const targetPrivileged = await hasInstancePrivileges(target.id, tx);
  if (
    !actor.isAdmin &&
    (!actor.permissions.includes("users:manage") || targetPrivileged)
  ) {
    throw new HTTPException(403, {
      message: "Instance administrator access required",
    });
  }

  if (target.role !== "admin") return;

  if ((await countOtherActiveAdmins(tx, target.id)) === 0) {
    throw new HTTPException(409, {
      message: "The instance must keep at least one administrator",
    });
  }
}
