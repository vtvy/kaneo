import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import {
  instanceRoleAssignmentTable,
  instanceRoleTable,
} from "../../database/admin-schema";
import type { DbOrTx } from "../audit/record-admin-action";
import { isBanActive } from "../users/is-ban-active";
import {
  CUSTOM_ROLE_PERMISSIONS,
  INSTANCE_PERMISSIONS,
  type InstancePermission,
} from "./permissions";

/** Stored authority, including banned accounts which must remain protected. */
export async function hasInstancePrivileges(
  userId: string,
  database: DbOrTx = db,
) {
  const [user] = await database
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  if (user?.role === "admin") return true;
  const [assigned] = await database
    .select({ permissions: instanceRoleTable.permissions })
    .from(instanceRoleAssignmentTable)
    .innerJoin(
      instanceRoleTable,
      eq(instanceRoleAssignmentTable.roleId, instanceRoleTable.id),
    )
    .where(eq(instanceRoleAssignmentTable.userId, userId));
  return (
    assigned?.permissions.some((permission) =>
      CUSTOM_ROLE_PERMISSIONS.includes(
        permission as (typeof CUSTOM_ROLE_PERMISSIONS)[number],
      ),
    ) ?? false
  );
}

export async function getInstanceAccess(userId: string, database: DbOrTx = db) {
  const [user] = await database
    .select({
      role: schema.userTable.role,
      banned: schema.userTable.banned,
      banExpires: schema.userTable.banExpires,
    })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  if (!user || isBanActive(user))
    return { isAdmin: false, permissions: [] as InstancePermission[] };
  if (user.role === "admin")
    return { isAdmin: true, permissions: [...INSTANCE_PERMISSIONS] };
  const [assigned] = await database
    .select({ permissions: instanceRoleTable.permissions })
    .from(instanceRoleAssignmentTable)
    .innerJoin(
      instanceRoleTable,
      eq(instanceRoleAssignmentTable.roleId, instanceRoleTable.id),
    )
    .where(eq(instanceRoleAssignmentTable.userId, userId));
  return {
    isAdmin: false,
    permissions: CUSTOM_ROLE_PERMISSIONS.filter((permission) =>
      assigned?.permissions.includes(permission),
    ),
  };
}
