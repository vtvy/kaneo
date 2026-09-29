import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

async function deleteRole(roleId: string) {
  const [existing] = await db
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
    throw new HTTPException(409, { message: "System role cannot be deleted" });
  }

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.projectMemberRoleTable)
    .where(eq(schema.projectMemberRoleTable.projectRoleId, roleId));

  if ((countRow?.count ?? 0) > 0) {
    throw new HTTPException(409, {
      message: "Role is still assigned to members",
    });
  }

  await db
    .delete(schema.projectRoleTable)
    .where(eq(schema.projectRoleTable.id, roleId));
}

export default deleteRole;
