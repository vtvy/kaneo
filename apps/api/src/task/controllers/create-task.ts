import { and, eq, isNull, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  applyDefaultCustomFieldValues,
  type CustomFieldValueInput,
  insertCustomFieldValues,
  resolveCreateCustomFieldValues,
} from "../../custom-field/task-values";
import db from "../../database";
import {
  columnTable,
  sprintTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import syncTaskSprintMembership from "../../sprint/controllers/sync-task-sprint-membership";
import type { TaskRecurrence } from "../recurrence/schema";
import {
  assertAssigneeInWorkspace,
  assertValidTaskStatus,
} from "../validate-task-fields";
import getNextTaskNumber from "./get-next-task-number";
import { recordTaskInvolvement } from "./record-task-involvement";

async function createTask({
  projectId,
  currentUserId,
  userId,
  title,
  status,
  sprintId,
  startDate,
  dueDate,
  description,
  priority,
  points,
  recurrence,
  createGitlabIssue,
  customFields,
  workItemType = "task",
  parentId = null,
}: {
  workItemType?: string;
  parentId?: string | null;
  projectId: string;
  currentUserId: string;
  userId?: string;
  title: string;
  status?: string | null;
  sprintId?: string | null;
  startDate?: Date;
  dueDate?: Date;
  description?: string;
  priority?: string;
  points?: number | null;
  recurrence?: TaskRecurrence | null;
  /** Opt-in: also create a linked GitLab issue when the project has one. */
  createGitlabIssue?: boolean;
  /**
   * Values to set on the new task. When sent (even empty), required fields
   * without a default must be included; when omitted, only defaults apply.
   */
  customFields?: CustomFieldValueInput[];
}) {
  // A task may have no status ("No status" / backlog). Only normalize a
  // provided, non-empty status; otherwise store null.
  const resolvedStatus = status ? status : null;
  const resolvedPriority = priority || "no-priority";

  if (resolvedStatus) {
    await assertValidTaskStatus(resolvedStatus, projectId);
  }

  // A task may optionally be created directly into a sprint. Be lenient: only
  // accept the sprint if it exists and belongs to the same project; otherwise
  // fall back to null rather than failing task creation.
  let resolvedSprintId: string | null = null;
  if (sprintId) {
    const sprint = await db.query.sprintTable.findFirst({
      where: and(
        eq(sprintTable.id, sprintId),
        eq(sprintTable.projectId, projectId),
      ),
    });
    resolvedSprintId = sprint ? sprint.id : null;
  }

  // A provided assignee must be a member of the project's workspace (this
  // also guarantees the user exists, so the FK insert below can't 500). An
  // empty/omitted userId is fine — the task is unassigned.
  await assertAssigneeInWorkspace(userId, projectId);

  const customFieldValues = customFields
    ? await resolveCreateCustomFieldValues(projectId, customFields)
    : [];

  const [assignee] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId ?? ""));

  const nextTaskNumber = await getNextTaskNumber(projectId);

  const column = resolvedStatus
    ? await db.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.slug, resolvedStatus),
        ),
      })
    : undefined;

  const [maxPositionResult] = await db
    .select({ maxPosition: max(taskTable.position) })
    .from(taskTable)
    .where(
      and(
        eq(taskTable.projectId, projectId),
        column?.id
          ? eq(taskTable.columnId, column.id)
          : resolvedStatus
            ? eq(taskTable.status, resolvedStatus)
            : isNull(taskTable.status),
      ),
    );

  const nextPosition = (maxPositionResult?.maxPosition ?? 0) + 1;
  const [rank] = await db
    .select({ max: max(taskTable.backlogRank) })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  const [createdTask] = await db
    .insert(taskTable)
    .values({
      projectId,
      userId: userId || null,
      reporterId: currentUserId || null,
      title: title || "",
      status: resolvedStatus,
      sprintId: resolvedSprintId,
      columnId: column?.id ?? null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      description: description || "",
      priority: resolvedPriority,
      points: points ?? null,
      type: workItemType,
      backlogRank: (rank?.max ?? 0) + 1,
      parentId,
      recurrence: recurrence ?? null,
      number: nextTaskNumber + 1,
      position: nextPosition,
    })
    .returning();

  if (!createdTask) {
    throw new HTTPException(500, {
      message: "Failed to create task",
    });
  }

  await recordTaskInvolvement(createdTask.id, currentUserId, "reporter");
  await recordTaskInvolvement(createdTask.id, userId, "assignee");
  await insertCustomFieldValues(createdTask.id, customFieldValues);
  await applyDefaultCustomFieldValues(createdTask.id, projectId);

  if (createdTask.sprintId) {
    await syncTaskSprintMembership(createdTask.id, createdTask.sprintId);
  }

  // `userId` on task.created is the actor (creator) for webhooks/activity.
  // Assignee lives on the task row and as `assigneeId` for notifications.
  await publishEvent("task.created", {
    ...createdTask,
    taskId: createdTask.id,
    userId: currentUserId,
    assigneeId: createdTask.userId ?? null,
    currentUserId,
    type: "created",
    content: null,
    createGitlabIssue: Boolean(createGitlabIssue),
  });

  return {
    ...createdTask,
    assigneeName: assignee?.name,
  };
}

export default createTask;
