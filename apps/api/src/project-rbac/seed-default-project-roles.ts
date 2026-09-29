import { and, eq, inArray, sql } from "drizzle-orm";
import db, { schema } from "../database";
import {
  DEFAULT_PROJECT_ROLE_NAMES,
  DEFAULT_PROJECT_ROLE_PAYLOADS,
  PROJECT_SYSTEM_OWNER,
} from "./catalog";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function seedProjectRoles(tx: Tx | typeof db, projectId: string) {
  const existing = await tx
    .select({ name: schema.projectRoleTable.name })
    .from(schema.projectRoleTable)
    .where(eq(schema.projectRoleTable.projectId, projectId));
  const present = new Set(existing.map((r) => r.name));

  for (const roleName of DEFAULT_PROJECT_ROLE_NAMES) {
    if (present.has(roleName)) continue;

    const [role] = await tx
      .insert(schema.projectRoleTable)
      .values({
        projectId,
        name: roleName,
        isSystem: roleName === PROJECT_SYSTEM_OWNER,
      })
      .returning({ id: schema.projectRoleTable.id });

    if (!role) continue;

    const payload = DEFAULT_PROJECT_ROLE_PAYLOADS[roleName];
    const permRows = Object.entries(payload).flatMap(([resource, actions]) =>
      actions.map((action) => ({
        projectRoleId: role.id,
        resource,
        action,
      })),
    );
    if (permRows.length > 0) {
      await tx.insert(schema.projectRolePermissionTable).values(permRows);
    }
  }
}

export async function addProjectMemberWithRole(
  tx: Tx | typeof db,
  projectId: string,
  userId: string,
  roleName: string,
) {
  const inserted = await tx
    .insert(schema.projectMemberTable)
    .values({ projectId, userId })
    .onConflictDoNothing({
      target: [
        schema.projectMemberTable.projectId,
        schema.projectMemberTable.userId,
      ],
    })
    .returning({ id: schema.projectMemberTable.id });

  const memberId =
    inserted[0]?.id ??
    (
      await tx
        .select({ id: schema.projectMemberTable.id })
        .from(schema.projectMemberTable)
        .where(
          and(
            eq(schema.projectMemberTable.projectId, projectId),
            eq(schema.projectMemberTable.userId, userId),
          ),
        )
        .limit(1)
    )[0]?.id;

  if (!memberId) return;

  const [role] = await tx
    .select({ id: schema.projectRoleTable.id })
    .from(schema.projectRoleTable)
    .where(
      and(
        eq(schema.projectRoleTable.projectId, projectId),
        eq(schema.projectRoleTable.name, roleName),
      ),
    )
    .limit(1);

  if (!role) return;

  await tx
    .insert(schema.projectMemberRoleTable)
    .values({ projectMemberId: memberId, projectRoleId: role.id })
    .onConflictDoNothing({
      target: [
        schema.projectMemberRoleTable.projectMemberId,
        schema.projectMemberRoleTable.projectRoleId,
      ],
    });
}

export async function seedDefaultProjectRoles() {
  try {
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'project_role'
      ) AS exists;`);
    const exists =
      (tableExists.rows[0] as Record<string, unknown>)?.exists === true ||
      (tableExists.rows[0] as Record<string, unknown>)?.exists === "t";
    if (!exists) return;

    const projects = await db
      .select({
        id: schema.projectTable.id,
        workspaceId: schema.projectTable.workspaceId,
      })
      .from(schema.projectTable);
    if (projects.length === 0) return;

    const projectIds = projects.map((p) => p.id);
    const seeded = await db
      .select({ projectId: schema.projectRoleTable.projectId })
      .from(schema.projectRoleTable)
      .where(inArray(schema.projectRoleTable.projectId, projectIds));
    const seededSet = new Set(seeded.map((r) => r.projectId));

    for (const project of projects) {
      if (!seededSet.has(project.id)) {
        await db.transaction((tx) => seedProjectRoles(tx, project.id));
      }

      // Backfill project members from workspace membership so existing
      // workspace members keep access after project-rbac cutover.
      const members = await db
        .select({
          userId: schema.workspaceUserTable.userId,
          role: schema.workspaceUserTable.role,
        })
        .from(schema.workspaceUserTable)
        .where(eq(schema.workspaceUserTable.workspaceId, project.workspaceId));

      for (const member of members) {
        const roleName =
          member.role === "owner" || member.role === "admin"
            ? "Owner"
            : "Member";
        await addProjectMemberWithRole(db, project.id, member.userId, roleName);
      }
    }
  } catch (error) {
    console.error("❌ Failed to seed default project roles:", error);
    throw error;
  }
}
