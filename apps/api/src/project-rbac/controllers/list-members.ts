import { eq, inArray } from "drizzle-orm";
import db, { schema } from "../../database";

async function listMembers(projectId: string) {
  const members = await db
    .select({
      id: schema.projectMemberTable.id,
      userId: schema.projectMemberTable.userId,
      userName: schema.userTable.name,
      userEmail: schema.userTable.email,
      userImage: schema.userTable.image,
    })
    .from(schema.projectMemberTable)
    .innerJoin(
      schema.userTable,
      eq(schema.userTable.id, schema.projectMemberTable.userId),
    )
    .where(eq(schema.projectMemberTable.projectId, projectId));

  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.id);
  const memberRoles = await db
    .select({
      projectMemberId: schema.projectMemberRoleTable.projectMemberId,
      roleId: schema.projectRoleTable.id,
      roleName: schema.projectRoleTable.name,
      isSystem: schema.projectRoleTable.isSystem,
    })
    .from(schema.projectMemberRoleTable)
    .innerJoin(
      schema.projectRoleTable,
      eq(
        schema.projectRoleTable.id,
        schema.projectMemberRoleTable.projectRoleId,
      ),
    )
    .where(inArray(schema.projectMemberRoleTable.projectMemberId, memberIds));

  const rolesByMember: Record<
    string,
    { id: string; name: string; isSystem: boolean }[]
  > = {};
  for (const mr of memberRoles) {
    let roles = rolesByMember[mr.projectMemberId];
    if (!roles) {
      roles = [];
      rolesByMember[mr.projectMemberId] = roles;
    }
    roles.push({
      id: mr.roleId,
      name: mr.roleName,
      isSystem: mr.isSystem,
    });
  }

  return members.map((m) => ({
    ...m,
    roles: rolesByMember[m.id] ?? [],
  }));
}

export default listMembers;
