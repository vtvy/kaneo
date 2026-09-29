import { and, eq } from "drizzle-orm";
import db, { schema } from "../database";
import { PROJECT_SYSTEM_OWNER, type ProjectPermissionMap } from "./catalog";

/**
 * Returns the user's workspace role for the workspace that owns this project,
 * or null when the user is not a member of that workspace.
 */
async function getWorkspaceRole(
  userId: string,
  projectId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ role: schema.workspaceUserTable.role })
    .from(schema.projectTable)
    .innerJoin(
      schema.workspaceUserTable,
      and(
        eq(
          schema.workspaceUserTable.workspaceId,
          schema.projectTable.workspaceId,
        ),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    )
    .where(eq(schema.projectTable.id, projectId))
    .limit(1);
  return row?.role ?? null;
}

export type ProjectStatements = Record<string, Set<string>>;

export async function resolveProjectStatements(
  userId: string,
  projectId: string,
): Promise<{ statements: ProjectStatements; isOwner: boolean }> {
  const rows = await db
    .select({
      roleName: schema.projectRoleTable.name,
      isSystem: schema.projectRoleTable.isSystem,
      resource: schema.projectRolePermissionTable.resource,
      action: schema.projectRolePermissionTable.action,
    })
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
      eq(
        schema.projectRoleTable.id,
        schema.projectMemberRoleTable.projectRoleId,
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
        eq(schema.projectMemberTable.projectId, projectId),
        eq(schema.projectMemberTable.userId, userId),
      ),
    );

  // No explicit project_member row → only workspace owner/admin get implicit
  // full access (covers projects that pre-date per-project RBAC). Regular
  // workspace members must be invited to a project to see or use it
  // (FR-PRJ-05). They may still sit in workspace_member so workspaceAccess
  // succeeds when opening a project they were added to.
  if (rows.length === 0) {
    const wsRole = await getWorkspaceRole(userId, projectId);
    if (wsRole === "owner" || wsRole === "admin") {
      return { statements: {}, isOwner: true };
    }
    return { statements: {}, isOwner: false };
  }

  const statements: ProjectStatements = {};
  let isOwner = false;
  for (const r of rows) {
    if (r.isSystem && r.roleName === PROJECT_SYSTEM_OWNER) isOwner = true;
    if (r.resource && r.action) {
      let set = statements[r.resource];
      if (!set) {
        set = new Set<string>();
        statements[r.resource] = set;
      }
      set.add(r.action);
    }
  }
  return { statements, isOwner };
}

export function satisfiesProject(
  statements: ProjectStatements,
  required: ProjectPermissionMap,
): boolean {
  for (const [resource, actions] of Object.entries(required)) {
    const granted = statements[resource];
    if (!granted) return false;
    for (const action of actions) if (!granted.has(action)) return false;
  }
  return true;
}

export async function canInProject(
  userId: string,
  projectId: string,
  resource: string,
  action: string,
): Promise<boolean> {
  const { statements, isOwner } = await resolveProjectStatements(
    userId,
    projectId,
  );
  if (isOwner) return true;
  return statements[resource]?.has(action) ?? false;
}

export async function canInProjectAll(
  userId: string,
  projectId: string,
  required: ProjectPermissionMap,
): Promise<boolean> {
  const { statements, isOwner } = await resolveProjectStatements(
    userId,
    projectId,
  );
  if (isOwner) return true;
  return satisfiesProject(statements, required);
}
