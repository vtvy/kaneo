import { and, eq, isNull, max } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  columnTable,
  sprintTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { assertValidTaskStatus } from "../validate-task-fields";
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
}: {
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

  const [assignee] = await db
    .select({ name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId ?? ""));

  // A provided assignee must exist, otherwise the FK insert below throws an
  // unhandled 500. (An empty/omitted userId is fine — the task is unassigned.)
  if (userId && !assignee) {
    throw new HTTPException(400, {
      message: "Assignee user not found",
    });
  }

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

  const [createdTask] = await db
    .insert(taskTable)
    .values({
      projectId,
      userId: userId || null,
      reporterId: currentUserId,
      title: title || "",
      status: resolvedStatus,
      sprintId: resolvedSprintId,
      columnId: column?.id ?? null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      description: description || "",
      priority: resolvedPriority,
      points: points ?? null,
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
  });

  return {
    ...createdTask,
    assigneeName: assignee?.name,
  };
}

export default createTask;
