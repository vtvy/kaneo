import { eq, inArray } from "drizzle-orm";
import db, { schema } from "../../database";

async function listRoles(projectId: string) {
  const roles = await db
    .select({
      id: schema.projectRoleTable.id,
      name: schema.projectRoleTable.name,
      isSystem: schema.projectRoleTable.isSystem,
      createdAt: schema.projectRoleTable.createdAt,
    })
    .from(schema.projectRoleTable)
    .where(eq(schema.projectRoleTable.projectId, projectId));

  if (roles.length === 0) return [];

  const roleIds = roles.map((r) => r.id);
  const permissions = await db
    .select({
      projectRoleId: schema.projectRolePermissionTable.projectRoleId,
      resource: schema.projectRolePermissionTable.resource,
      action: schema.projectRolePermissionTable.action,
    })
    .from(schema.projectRolePermissionTable)
    .where(inArray(schema.projectRolePermissionTable.projectRoleId, roleIds));

  const permsByRole: Record<string, Record<string, string[]>> = {};
  for (const p of permissions) {
    let rolePerms = permsByRole[p.projectRoleId];
    if (!rolePerms) {
      rolePerms = {};
      permsByRole[p.projectRoleId] = rolePerms;
    }
    let actions = rolePerms[p.resource];
    if (!actions) {
      actions = [];
      rolePerms[p.resource] = actions;
    }
    actions.push(p.action);
  }

  return roles.map((r) => ({
    ...r,
    permissions: permsByRole[r.id] ?? {},
  }));
}

export default listRoles;
