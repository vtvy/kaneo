import { and, eq, inArray, or, type SQL } from "drizzle-orm";
import db, { schema } from "../database";
import { PROJECT_SYSTEM_OWNER } from "./catalog";

/**
 * SQL condition on `project.id` limiting a workspace-wide query to projects
 * the user may read (`item:read`), mirroring `canInProject`:
 * workspace owner/admin implicitly read every project; everyone else needs a
 * project_member row whose project-local role is the system Owner or grants
 * item:read. Returns `undefined` when no restriction applies.
 */
export async function readableProjectsCondition(
  userId: string,
  workspaceId: string,
): Promise<SQL | undefined> {
  const [membership] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  if (membership?.role === "owner" || membership?.role === "admin") {
    return undefined;
  }

  const readable = db
    .selectDistinct({ projectId: schema.projectMemberTable.projectId })
    .from(schema.projectMemberTable)
    .innerJoin(
      schema.projectMemberRoleTable,
      eq(
        schema.projectMemberRoleTable.projectMemberId,
        schema.projectMemberTable.id,
      ),
    )
    .innerJoin(
      schema.projectRoleTable,
      and(
        eq(
          schema.projectRoleTable.id,
          schema.projectMemberRoleTable.projectRoleId,
        ),
        eq(
          schema.projectRoleTable.projectId,
          schema.projectMemberTable.projectId,
        ),
      ),
    )
    .leftJoin(
      schema.projectRolePermissionTable,
      eq(
        schema.projectRolePermissionTable.projectRoleId,
        schema.projectRoleTable.id,
      ),
    )
    .where(
      and(
        eq(schema.projectMemberTable.userId, userId),
        or(
          and(
            eq(schema.projectRoleTable.isSystem, true),
            eq(schema.projectRoleTable.name, PROJECT_SYSTEM_OWNER),
          ),
          and(
            eq(schema.projectRolePermissionTable.resource, "item"),
            eq(schema.projectRolePermissionTable.action, "read"),
          ),
        ),
      ),
    );

  return inArray(schema.projectTable.id, readable);
}
