import { eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskRelationTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteS3Keys, getTaskAssetKeys } from "../../storage/cleanup-assets";
import getTask from "./get-task";
import recordTaskDeletion from "./record-task-deletion";

async function deleteTask(taskId: string, currentUserId: string) {
  const task = await getTask(taskId);

  const relations = await db
    .select()
    .from(taskRelationTable)
    .where(
      or(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.targetTaskId, taskId),
      ),
    )
    .execute();

  const assetKeys = await getTaskAssetKeys(taskId);

  const deletion = await recordTaskDeletion(
    {
      taskId: task.id,
      projectId: task.projectId,
      title: task.title,
      number: task.number,
      reporterId: task.reporterId,
      assigneeId: task.userId,
    },
    currentUserId,
  );

  const [deletedTask] = await db
    .delete(taskTable)
    .where(eq(taskTable.id, taskId))
    .returning()
    .execute();

  if (!deletedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await publishEvent("task.deleted", {
    taskId: task.id,
    projectId: task.projectId,
    userId: currentUserId,
    title: task.title,
    number: task.number,
    reporterId: task.reporterId,
    assigneeId: task.userId,
    workspaceId: deletion?.workspaceId,
    deletedByName: deletion?.deletedByName,
  });

  for (const relation of relations) {
    await publishEvent("task-relation.deleted", {
      projectId: task.projectId,
      userId: currentUserId,
      taskId: taskId,
      sourceTaskId: relation.sourceTaskId,
      targetTaskId: relation.targetTaskId,
    });
  }

  // Fire-and-forget S3 cleanup after successful DB delete
  if (assetKeys.length > 0) {
    deleteS3Keys(assetKeys).catch(() => {});
  }

  return task;
}

export default deleteTask;
