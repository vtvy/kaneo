import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";

async function assignMemberRoles(memberId: string, roleIds: string[]) {
  const [member] = await db
    .select({ id: schema.projectMemberTable.id })
    .from(schema.projectMemberTable)
    .where(eq(schema.projectMemberTable.id, memberId))
    .limit(1);

  if (!member) {
    throw new HTTPException(404, { message: "Member not found" });
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.projectMemberRoleTable)
      .where(eq(schema.projectMemberRoleTable.projectMemberId, memberId));

    if (roleIds.length > 0) {
      await tx.insert(schema.projectMemberRoleTable).values(
        roleIds.map((roleId) => ({
          projectMemberId: memberId,
          projectRoleId: roleId,
        })),
      );
    }
  });
}

export default assignMemberRoles;
