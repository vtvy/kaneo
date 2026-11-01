import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { assignWorkItemSprint } from "../../work-item/assign-sprint";

async function removeTaskFromSprint({
  taskId,
  currentUserId,
}: {
  taskId: string;
  currentUserId: string;
}) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const previousSprintId = task.sprintId;

  const updatedTask = await assignWorkItemSprint(taskId, task.projectId, null);

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to remove task from sprint",
    });
  }

  await publishEvent("task.sprint_changed", {
    taskId,
    userId: currentUserId,
    sprintId: null,
    previousSprintId,
    type: "sprint_changed",
  });

  return updatedTask;
}

export default removeTaskFromSprint;
