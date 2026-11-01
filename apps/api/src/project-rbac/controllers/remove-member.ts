import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { recheckSocketAccess } from "../../ws";
import { PROJECT_SYSTEM_OWNER } from "../catalog";

async function removeMember(projectId: string, memberId: string) {
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

  const ownerRole = await db
    .select({ id: schema.projectMemberRoleTable.id })
    .from(schema.projectMemberRoleTable)
    .innerJoin(
      schema.projectRoleTable,
      eq(
        schema.projectRoleTable.id,
        schema.projectMemberRoleTable.projectRoleId,
      ),
    )
    .where(
      and(
        eq(schema.projectMemberRoleTable.projectMemberId, memberId),
        eq(schema.projectRoleTable.name, PROJECT_SYSTEM_OWNER),
        eq(schema.projectRoleTable.isSystem, true),
      ),
    )
    .limit(1);

  if (ownerRole.length > 0) {
    throw new HTTPException(409, {
      message: "Cannot remove the project Owner",
    });
  }

  await db
    .delete(schema.projectMemberTable)
    .where(eq(schema.projectMemberTable.id, memberId));

  await recheckSocketAccess(member.userId, { projectId });
}

export default removeMember;
