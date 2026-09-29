import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function assignTaskToSprint({
  id,
  taskId,
  currentUserId,
}: {
  id: string;
  taskId: string;
  currentUserId: string;
}) {
  const sprint = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });

  if (!sprint) {
    throw new HTTPException(404, {
      message: "Sprint not found",
    });
  }

  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!task) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (task.projectId !== sprint.projectId) {
    throw new HTTPException(400, {
      message: "Task does not belong to the same project as the sprint",
    });
  }

  const [updatedTask] = await db
    .update(taskTable)
    .set({ sprintId: id })
    .where(eq(taskTable.id, taskId))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to assign task to sprint",
    });
  }

  await publishEvent("task.sprint_changed", {
    taskId,
    userId: currentUserId,
    sprintId: id,
    sprintName: sprint.name,
    type: "sprint_changed",
  });

  return updatedTask;
}

export default assignTaskToSprint;
