import { and, eq, inArray, isNotNull, notInArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  assetTable,
  externalLinkTable,
  githubIntegrationTable,
  integrationTable,
  labelTable,
  notificationTable,
  projectMemberTable,
  projectTable,
  taskDeletionTable,
  taskInvolvementTable,
  taskRelationTable,
  taskTable,
  userNotificationWorkspaceProjectTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { canInProjectAll } from "../../project-rbac/can-in-project";
import {
  addProjectMemberWithRole,
  seedProjectRoles,
} from "../../project-rbac/seed-default-project-roles";
import { memberHasWorkspacePermission } from "../../utils/require-workspace-permission";

type MoveProjectInput = {
  projectId: string;
  sourceWorkspaceId: string;
  targetWorkspaceId: string;
  userId: string;
  isInstanceAdmin: boolean;
};

const ACTIVITY_INSERT_CHUNK = 500;

async function workspaceRole(userId: string, workspaceId: string) {
  const [row] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);
  return row?.role ?? null;
}

/**
 * The caller must manage the project where it lives (project role:manage, or
 * workspace owner/admin there), belong to the destination workspace, and be
 * allowed to create projects in it.
 */
async function assertCanMoveProject({
  projectId,
  sourceWorkspaceId,
  targetWorkspaceId,
  userId,
  isInstanceAdmin,
}: MoveProjectInput) {
  if (sourceWorkspaceId === targetWorkspaceId) {
    throw new HTTPException(400, {
      message: "Project already belongs to this workspace",
    });
  }

  if (!isInstanceAdmin) {
    const sourceRole = await workspaceRole(userId, sourceWorkspaceId);
    const managesSource =
      sourceRole === "owner" ||
      sourceRole === "admin" ||
      (await canInProjectAll(userId, projectId, { role: ["manage"] }));
    if (!managesSource) {
      throw new HTTPException(403, {
        message: "You can't manage this project",
      });
    }
  }

  // Membership is required even for instance admins: the project lands in a
  // workspace the caller must be able to open afterwards.
  if (!(await workspaceRole(userId, targetWorkspaceId))) {
    throw new HTTPException(403, {
      message: "You are not a member of the target workspace",
    });
  }

  if (
    !isInstanceAdmin &&
    !(await memberHasWorkspacePermission(userId, targetWorkspaceId, {
      project: ["create"],
    }))
  ) {
    throw new HTTPException(403, {
      message: "You can't create projects in the target workspace",
    });
  }
}

/**
 * Move a project, and everything hanging off it, to another workspace.
 *
 * Project-scoped rows (columns, sprints, roles, custom fields, folders,
 * documents, workflow rules, comments, time entries, activity) follow the
 * project through its id. Rows that are tied to a workspace or to people are
 * reconciled against the destination in the same transaction.
 */
async function moveProject(input: MoveProjectInput) {
  await assertCanMoveProject(input);
  const { projectId: id, sourceWorkspaceId, targetWorkspaceId, userId } = input;

  const result = await db.transaction(async (tx) => {
    // Stable lock order across both workspaces, then lock the project row:
    // the caller was authorized against the source workspace, so a
    // concurrent move must not change that basis mid-transaction.
    for (const workspaceId of [sourceWorkspaceId, targetWorkspaceId].sort()) {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(1524, hashtext(${workspaceId}))`,
      );
    }

    const [existingProject] = await tx
      .select()
      .from(projectTable)
      .where(
        and(
          eq(projectTable.id, id),
          eq(projectTable.workspaceId, sourceWorkspaceId),
        ),
      )
      .for("update");

    if (!existingProject) {
      throw new HTTPException(404, {
        message:
          "Project doesn't exist or doesn't belong to the specified workspace",
      });
    }

    // The key is the ticket-id prefix (KAN-12); two projects sharing it in
    // one workspace would make those ids ambiguous.
    const [keyConflict] = await tx
      .select({ id: projectTable.id, name: projectTable.name })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.workspaceId, targetWorkspaceId),
          sql`lower(${projectTable.slug}) = lower(${existingProject.slug})`,
        ),
      )
      .limit(1);

    if (keyConflict) {
      throw new HTTPException(409, {
        message: `The target workspace already has a project using the key "${existingProject.slug}" (${keyConflict.name}). Change this project's key before moving it.`,
      });
    }

    const linked = await tx.execute(sql`
      SELECT 1 FROM ${taskRelationTable} relation
      JOIN ${taskTable} source ON source.id = relation.source_task_id
      JOIN ${taskTable} target ON target.id = relation.target_task_id
      WHERE (source.project_id = ${id} AND target.project_id <> ${id})
         OR (target.project_id = ${id} AND source.project_id <> ${id})
      LIMIT 1
    `);
    if (linked.rows.length > 0) {
      throw new HTTPException(409, {
        message:
          "Remove task relationships to other projects before moving this project.",
      });
    }

    // Subqueries rather than id lists: both scale with workspace or project
    // size and Postgres caps a statement at 65535 bind parameters.
    const targetMembers = tx
      .select({ userId: workspaceUserTable.userId })
      .from(workspaceUserTable)
      .where(eq(workspaceUserTable.workspaceId, targetWorkspaceId));
    const projectTasks = taskIdsQuery(tx, id);

    // These subscriptions carry composite keys to a notification rule that
    // stays behind in the source workspace.
    await tx
      .delete(userNotificationWorkspaceProjectTable)
      .where(
        and(
          eq(userNotificationWorkspaceProjectTable.projectId, id),
          eq(
            userNotificationWorkspaceProjectTable.workspaceId,
            sourceWorkspaceId,
          ),
        ),
      );

    const [movedProject] = await tx
      .update(projectTable)
      .set({ workspaceId: targetWorkspaceId })
      .where(
        and(
          eq(projectTable.id, id),
          eq(projectTable.workspaceId, sourceWorkspaceId),
        ),
      )
      .returning();

    if (!movedProject) {
      throw new HTTPException(409, {
        message: "Project was moved to another workspace, please try again",
      });
    }

    // Project members outside the destination lose their membership (their
    // role assignments cascade). Members of both workspaces keep their roles.
    const removedMembers = await tx
      .delete(projectMemberTable)
      .where(
        and(
          eq(projectMemberTable.projectId, id),
          notInArray(projectMemberTable.userId, targetMembers),
        ),
      )
      .returning({ userId: projectMemberTable.userId });

    // A workspace admin may have managed the project without an explicit
    // membership; make sure the mover can still reach it in the destination.
    await seedProjectRoles(tx, id);
    const [moverMembership] = await tx
      .select({ id: projectMemberTable.id })
      .from(projectMemberTable)
      .where(
        and(
          eq(projectMemberTable.projectId, id),
          eq(projectMemberTable.userId, userId),
        ),
      )
      .limit(1);
    if (!moverMembership) {
      await addProjectMemberWithRole(tx, id, userId, "Owner");
    }

    // Assignees outside the destination are unassigned; each gets an
    // activity row so the history explains why.
    const unassignedTasks = await tx
      .update(taskTable)
      .set({ userId: null })
      .where(
        and(
          eq(taskTable.projectId, id),
          isNotNull(taskTable.userId),
          notInArray(taskTable.userId, targetMembers),
        ),
      )
      .returning({ id: taskTable.id });

    for (let i = 0; i < unassignedTasks.length; i += ACTIVITY_INSERT_CHUNK) {
      await tx.insert(activityTable).values(
        unassignedTasks.slice(i, i + ACTIVITY_INSERT_CHUNK).map((task) => ({
          taskId: task.id,
          type: "unassigned",
          userId,
          content: null,
          eventData: { reason: "project_moved" },
        })),
      );
    }

    await tx
      .update(taskTable)
      .set({ reporterId: null })
      .where(
        and(
          eq(taskTable.projectId, id),
          isNotNull(taskTable.reporterId),
          notInArray(taskTable.reporterId, targetMembers),
        ),
      );

    // "Involved" discovery rows and task notifications would point people
    // outside the destination at tasks they can no longer open.
    await tx
      .delete(taskInvolvementTable)
      .where(
        and(
          inArray(taskInvolvementTable.taskId, projectTasks),
          notInArray(taskInvolvementTable.userId, targetMembers),
        ),
      );
    await tx
      .delete(notificationTable)
      .where(
        and(
          eq(notificationTable.resourceType, "task"),
          inArray(notificationTable.resourceId, projectTasks),
          notInArray(notificationTable.userId, targetMembers),
        ),
      );

    // Older task moves could leave links owned by another project's
    // integration.
    await tx
      .delete(externalLinkTable)
      .where(
        and(
          inArray(externalLinkTable.taskId, projectTasks),
          notInArray(
            externalLinkTable.integrationId,
            tx
              .select({ id: integrationTable.id })
              .from(integrationTable)
              .where(eq(integrationTable.projectId, id)),
          ),
        ),
      );

    // Integrations were configured (tokens, webhook secrets, channels) by
    // the source workspace. Deactivate them so they don't keep acting in the
    // destination until someone there reviews and re-enables them.
    const deactivatedIntegrations = await tx
      .update(integrationTable)
      .set({ isActive: false })
      .where(
        and(
          eq(integrationTable.projectId, id),
          eq(integrationTable.isActive, true),
        ),
      )
      .returning({ id: integrationTable.id, type: integrationTable.type });
    const deactivatedGithub = await tx
      .update(githubIntegrationTable)
      .set({ isActive: false })
      .where(
        and(
          eq(githubIntegrationTable.projectId, id),
          eq(githubIntegrationTable.isActive, true),
        ),
      )
      .returning({ id: githubIntegrationTable.id });

    // Asset rows denormalize the workspace (download access is checked
    // against it). Object keys stay as they are: they are stored per row, so
    // the blobs keep resolving without being copied.
    await tx
      .update(assetTable)
      .set({ workspaceId: targetWorkspaceId })
      .where(eq(assetTable.projectId, id));

    await tx
      .update(taskDeletionTable)
      .set({ workspaceId: targetWorkspaceId })
      .where(eq(taskDeletionTable.projectId, id));

    await remapTaskLabels(tx, projectTasks, targetWorkspaceId);

    return {
      movedProject,
      unassignedTaskCount: unassignedTasks.length,
      removedMemberIds: removedMembers.map((member) => member.userId),
      deactivatedIntegrationCount:
        deactivatedIntegrations.length + deactivatedGithub.length,
    };
  });

  await publishEvent("project.moved", {
    projectId: id,
    sourceWorkspaceId,
    targetWorkspaceId,
    userId,
  });

  return {
    ...result.movedProject,
    unassignedTaskCount: result.unassignedTaskCount,
    removedMemberCount: result.removedMemberIds.length,
    deactivatedIntegrationCount: result.deactivatedIntegrationCount,
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Task labels are per-task rows that copy a workspace label's name and color.
 * Repoint them at the destination, adopt the destination's color where it
 * already has a label of that name, and create the workspace labels it lacks
 * so the labels stay pickable there.
 */
async function remapTaskLabels(
  tx: Tx,
  projectTasks: ReturnType<typeof taskIdsQuery>,
  targetWorkspaceId: string,
) {
  await tx
    .update(labelTable)
    .set({ workspaceId: targetWorkspaceId })
    .where(inArray(labelTable.taskId, projectTasks));

  await tx.execute(sql`
    UPDATE ${labelTable} AS task_label
    SET color = workspace_label.color
    FROM ${labelTable} AS workspace_label
    WHERE workspace_label.workspace_id = ${targetWorkspaceId}
      AND workspace_label.task_id IS NULL
      AND workspace_label.name = task_label.name
      AND task_label.task_id IN (${projectTasks})
      AND task_label.color <> workspace_label.color
  `);

  const usedLabels = await tx
    .selectDistinctOn([labelTable.name], {
      name: labelTable.name,
      color: labelTable.color,
    })
    .from(labelTable)
    .where(inArray(labelTable.taskId, projectTasks))
    .orderBy(labelTable.name, labelTable.createdAt);

  if (usedLabels.length === 0) return;

  await tx
    .insert(labelTable)
    .values(
      usedLabels.map((label) => ({
        name: label.name,
        color: label.color,
        taskId: null,
        workspaceId: targetWorkspaceId,
      })),
    )
    .onConflictDoNothing({
      target: [labelTable.workspaceId, labelTable.name],
      where: sql`${labelTable.taskId} is null`,
    });
}

function taskIdsQuery(tx: Tx, projectId: string) {
  return tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));
}

export default moveProject;
