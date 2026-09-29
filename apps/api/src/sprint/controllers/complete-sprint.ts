import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, sprintTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { getSprintTotals } from "./get-sprint-totals";

async function completeSprint({
  id,
  targetSprintId,
  currentUserId,
}: {
  id: string;
  targetSprintId?: string | null;
  currentUserId: string;
}) {
  const existingSprint = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });

  if (!existingSprint) {
    throw new HTTPException(404, {
      message: "Sprint not found",
    });
  }

  if (existingSprint.state === "completed") {
    throw new HTTPException(400, {
      message: "Sprint is already completed",
    });
  }

  if (targetSprintId) {
    const targetSprint = await db.query.sprintTable.findFirst({
      where: and(
        eq(sprintTable.id, targetSprintId),
        eq(sprintTable.projectId, existingSprint.projectId),
      ),
    });

    if (!targetSprint) {
      throw new HTTPException(404, {
        message: "Target sprint not found in this project",
      });
    }
  }

  // Capture the sprint's task/point totals before carry-over moves any tasks
  // out, so the completion snapshot reflects the sprint as it was completed.
  const completionSnapshot = await getSprintTotals(id);

  // Carry-over: tasks in this sprint whose column is NOT final move to the
  // backlog (sprintId = null) or the optional target sprint. Tasks whose
  // column IS final keep their sprintId (kept as history). Tasks with no
  // column are treated as not-final and carried over.
  const carryOverTasks = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(
      and(
        eq(taskTable.sprintId, id),
        or(isNull(taskTable.columnId), eq(columnTable.isFinal, false)),
      ),
    );

  const carryOverIds = carryOverTasks.map((task) => task.id);

  if (carryOverIds.length > 0) {
    await db
      .update(taskTable)
      .set({ sprintId: targetSprintId ?? null })
      .where(inArray(taskTable.id, carryOverIds));
  }

  const [completedSprint] = await db
    .update(sprintTable)
    .set({ state: "completed", completedAt: new Date() })
    .where(eq(sprintTable.id, id))
    .returning();

  if (!completedSprint) {
    throw new HTTPException(500, {
      message: "Failed to complete sprint",
    });
  }

  await publishEvent("sprint.completed", {
    ...completedSprint,
    sprintId: completedSprint.id,
    projectId: completedSprint.projectId,
    userId: currentUserId,
    targetSprintId: targetSprintId ?? null,
    carriedOverTaskIds: carryOverIds,
    totalTasks: completionSnapshot.totalTasks,
    completedTasks: completionSnapshot.completedTasks,
    totalPoints: completionSnapshot.totalPoints,
    completedPoints: completionSnapshot.completedPoints,
    type: "completed",
    content: null,
  });

  return {
    ...completedSprint,
    ...completionSnapshot,
  };
}

export default completeSprint;
