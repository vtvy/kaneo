import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteOrphanedAssets } from "../../storage/cleanup-assets";
import { assertValidTaskStatus } from "../validate-task-fields";
import { recordAssigneeHandoff } from "./record-task-involvement";

async function updateTask(
  id: string,
  title: string,
  status: string | null | undefined,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  description: string,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
  points?: number | null,
) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, id),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  // A task may have no status ("No status" / backlog). Normalize empty to null.
  const resolvedStatus = status ? status : null;

  await assertValidTaskStatus(resolvedStatus, projectId);

  const column = resolvedStatus
    ? await db.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.slug, resolvedStatus),
        ),
      })
    : undefined;

  const [updatedTask] = await db
    .update(taskTable)
    .set({
      title,
      status: resolvedStatus,
      columnId: column?.id ?? null,
      startDate: startDate || null,
      dueDate: dueDate || null,
      projectId,
      description,
      priority,
      ...(points !== undefined ? { points } : {}),
      position,
      userId: userId || null,
    })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task",
    });
  }

  const nextAssigneeId = userId || null;
  if (existingTask.userId !== nextAssigneeId) {
    await recordAssigneeHandoff({
      taskId: updatedTask.id,
      previousAssigneeId: existingTask.userId,
      nextAssigneeId,
    });
  }

  if (existingTask.status !== resolvedStatus) {
    await publishEvent("task.status_changed", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
      oldStatus: existingTask.status,
      newStatus: resolvedStatus,
      title: updatedTask.title,
      assigneeId: updatedTask.userId,
      type: "status_changed",
    });

    await publishEvent("task-relation.refresh", {
      projectId: updatedTask.projectId,
      userId: currentUserId,
    });
  }

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  if (existingTask.description !== description) {
    deleteOrphanedAssets(existingTask.description, description, {
      taskId: id,
    }).catch(() => {});
  }

  return updatedTask;
}

export default updateTask;
