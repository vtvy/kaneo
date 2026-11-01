import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, sprintTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { buildCompletionSnapshot } from "../completion-snapshot";
import { sprintColumns } from "../sprint-columns";
import syncTaskSprintMembership from "./sync-task-sprint-membership";

async function completeSprint({
  id,
  targetSprintId,
  currentUserId,
}: {
  id: string;
  targetSprintId?: string | null;
  currentUserId: string;
}) {
  const { completedSprint, completionSnapshot, carryOverIds } =
    await db.transaction(async (tx) => {
      // Row lock so two concurrent completes cannot both pass the state check.
      const [existingSprint] = await tx
        .select({ projectId: sprintTable.projectId, state: sprintTable.state })
        .from(sprintTable)
        .where(eq(sprintTable.id, id))
        .for("update");

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
        const targetSprint = await tx.query.sprintTable.findFirst({
          where: and(
            eq(sprintTable.id, targetSprintId),
            eq(sprintTable.projectId, existingSprint.projectId),
          ),
          columns: { id: true },
        });

        if (!targetSprint) {
          throw new HTTPException(404, {
            message: "Target sprint not found in this project",
          });
        }
      }

      // The snapshot is built from the sprint's tasks before carry-over
      // moves any of them out, so it reflects the sprint as it was completed.
      const sprintTasks = await tx
        .select({
          id: taskTable.id,
          number: taskTable.number,
          title: taskTable.title,
          points: taskTable.points,
          isFinal: columnTable.isFinal,
        })
        .from(taskTable)
        .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
        .where(eq(taskTable.sprintId, id))
        .orderBy(asc(taskTable.number));

      const completedAt = new Date();
      const snapshot = buildCompletionSnapshot({
        tasks: sprintTasks,
        completedAt,
        completedBy: currentUserId,
        targetSprintId: targetSprintId ?? null,
      });

      // Carry-over: tasks in this sprint whose column is NOT final move to
      // the backlog (sprintId = null) or the optional target sprint. Tasks
      // whose column IS final keep their sprintId (kept as history). Tasks
      // with no column are treated as not-final and carried over.
      const carryOverIds = sprintTasks
        .filter((task) => task.isFinal !== true)
        .map((task) => task.id);

      if (carryOverIds.length > 0) {
        await tx
          .update(taskTable)
          .set({ sprintId: targetSprintId ?? null })
          .where(inArray(taskTable.id, carryOverIds));
      }

      for (const taskId of carryOverIds) {
        await syncTaskSprintMembership(taskId, targetSprintId ?? null, tx);
      }

      const [updatedSprint] = await tx
        .update(sprintTable)
        .set({
          state: "completed",
          completedAt,
          completionSnapshot: snapshot,
        })
        .where(eq(sprintTable.id, id))
        .returning(sprintColumns);

      if (!updatedSprint) {
        throw new HTTPException(500, {
          message: "Failed to complete sprint",
        });
      }

      return {
        completedSprint: updatedSprint,
        completionSnapshot: snapshot,
        carryOverIds,
      };
    });

  const totals = {
    totalTasks: completionSnapshot.tasks.total,
    completedTasks: completionSnapshot.tasks.done,
    totalPoints: completionSnapshot.points.total,
    completedPoints: completionSnapshot.points.done,
  };

  await publishEvent("sprint.completed", {
    ...completedSprint,
    sprintId: completedSprint.id,
    projectId: completedSprint.projectId,
    userId: currentUserId,
    targetSprintId: targetSprintId ?? null,
    carriedOverTaskIds: carryOverIds,
    ...totals,
    type: "completed",
    content: null,
  });

  return {
    ...completedSprint,
    ...totals,
    completionSnapshot,
  };
}

export default completeSprint;
