import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { recheckSocketAccess } from "../../ws";

async function assignMemberRoles(
  projectId: string,
  memberId: string,
  roleIds: string[],
) {
  const [member] = await db
    .select({
      id: schema.projectMemberTable.id,
      userId: schema.projectMemberTable.userId,
    })
    .from(schema.projectMemberTable)
    .where(
      and(
        eq(schema.projectMemberTable.id, memberId),
        eq(schema.projectMemberTable.projectId, projectId),
      ),
    )
    .limit(1);

  if (!member) {
    throw new HTTPException(404, { message: "Member not found" });
  }

  const uniqueRoleIds = [...new Set(roleIds)];
  if (uniqueRoleIds.length > 0) {
    const roles = await db
      .select({ id: schema.projectRoleTable.id })
      .from(schema.projectRoleTable)
      .where(
        and(
          inArray(schema.projectRoleTable.id, uniqueRoleIds),
          eq(schema.projectRoleTable.projectId, projectId),
        ),
      );

    if (roles.length !== uniqueRoleIds.length) {
      throw new HTTPException(400, {
        message: "One or more roles do not belong to this project",
      });
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.projectMemberRoleTable)
      .where(eq(schema.projectMemberRoleTable.projectMemberId, memberId));

    if (uniqueRoleIds.length > 0) {
      await tx.insert(schema.projectMemberRoleTable).values(
        uniqueRoleIds.map((roleId) => ({
          projectMemberId: memberId,
          projectRoleId: roleId,
        })),
      );
    }
  });

  // Dropping roles can remove read access to the project.
  await recheckSocketAccess(member.userId, { projectId });
}

export default assignMemberRoles;
