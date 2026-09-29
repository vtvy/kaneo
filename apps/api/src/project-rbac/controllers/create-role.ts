import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { ProjectPermissionMap } from "../catalog";

async function createRole(
  projectId: string,
  name: string,
  permissions: ProjectPermissionMap,
) {
  return db.transaction(async (tx) => {
    const [role] = await tx
      .insert(schema.projectRoleTable)
      .values({ projectId, name, isSystem: false })
      .returning();

    if (!role) {
      throw new HTTPException(500, { message: "Failed to create role" });
    }

    const permRows = Object.entries(permissions).flatMap(
      ([resource, actions]) =>
        actions.map((action) => ({
          projectRoleId: role.id,
          resource,
          action,
        })),
    );

    if (permRows.length > 0) {
      await tx.insert(schema.projectRolePermissionTable).values(permRows);
    }

    const permsByResource: Record<string, string[]> = {};
    for (const row of permRows) {
      let actions = permsByResource[row.resource];
      if (!actions) {
        actions = [];
        permsByResource[row.resource] = actions;
      }
      actions.push(row.action);
    }

    return { ...role, permissions: permsByResource };
  });
}

export default createRole;
