import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import type { ProjectPermissionMap } from "../catalog";

async function updateRole(
  roleId: string,
  name?: string,
  permissions?: ProjectPermissionMap,
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: schema.projectRoleTable.id,
        isSystem: schema.projectRoleTable.isSystem,
      })
      .from(schema.projectRoleTable)
      .where(eq(schema.projectRoleTable.id, roleId))
      .limit(1);

    if (!existing) {
      throw new HTTPException(404, { message: "Role not found" });
    }
    if (existing.isSystem) {
      throw new HTTPException(409, {
        message: "System role cannot be modified",
      });
    }

    if (name) {
      await tx
        .update(schema.projectRoleTable)
        .set({ name })
        .where(eq(schema.projectRoleTable.id, roleId));
    }

    if (permissions !== undefined) {
      await tx
        .delete(schema.projectRolePermissionTable)
        .where(eq(schema.projectRolePermissionTable.projectRoleId, roleId));

      const permRows = Object.entries(permissions).flatMap(
        ([resource, actions]) =>
          actions.map((action) => ({
            projectRoleId: roleId,
            resource,
            action,
          })),
      );
      if (permRows.length > 0) {
        await tx.insert(schema.projectRolePermissionTable).values(permRows);
      }
    }

    const [updated] = await tx
      .select()
      .from(schema.projectRoleTable)
      .where(eq(schema.projectRoleTable.id, roleId))
      .limit(1);

    return updated;
  });
}

export default updateRole;
