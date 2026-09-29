import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../../database";
import { addProjectMemberWithRole } from "../seed-default-project-roles";

async function addMember(
  projectId: string,
  email: string,
  roleNames: string[],
) {
  // 1. Find the user by email
  const [user] = await db
    .select({ id: schema.userTable.id })
    .from(schema.userTable)
    .where(eq(schema.userTable.email, email))
    .limit(1);

  if (!user) {
    throw new HTTPException(404, {
      message: "No account found for this email address.",
    });
  }

  // 2. Get the project's workspaceId
  const [project] = await db
    .select({ workspaceId: schema.projectTable.workspaceId })
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, { message: "Project not found." });
  }

  // 3. Add to workspace if not already a member
  const [existingWorkspaceMember] = await db
    .select({ id: schema.workspaceUserTable.id })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, project.workspaceId),
        eq(schema.workspaceUserTable.userId, user.id),
      ),
    )
    .limit(1);

  if (!existingWorkspaceMember) {
    await db.insert(schema.workspaceUserTable).values({
      id: createId(),
      workspaceId: project.workspaceId,
      userId: user.id,
      role: "member",
      joinedAt: new Date(),
    });
  }

  // 4. Check if already a project member
  const [existingProjectMember] = await db
    .select({ id: schema.projectMemberTable.id })
    .from(schema.projectMemberTable)
    .where(
      and(
        eq(schema.projectMemberTable.projectId, projectId),
        eq(schema.projectMemberTable.userId, user.id),
      ),
    )
    .limit(1);

  if (existingProjectMember) {
    throw new HTTPException(409, {
      message: "This user is already a member of the project.",
    });
  }

  // 5. Add to project with the specified roles
  const rolesToAssign = roleNames.length > 0 ? roleNames : ["Member"];
  for (const roleName of rolesToAssign) {
    await addProjectMemberWithRole(db, projectId, user.id, roleName);
  }
}

export default addMember;
