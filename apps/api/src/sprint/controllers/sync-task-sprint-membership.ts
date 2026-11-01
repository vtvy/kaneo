import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../../database";
import { taskSprintTable } from "../../database/schema";
import { planSprintMembershipChange } from "../sprint-membership";

// Records the task's move into `nextSprintId` (null = backlog) in the
// task_sprint history: closes the open row, then reopens or inserts the next.
async function syncTaskSprintMembership(
  taskId: string,
  nextSprintId: string | null,
) {
  const now = new Date();
  const memberships = await db
    .select({
      sprintId: taskSprintTable.sprintId,
      addedAt: taskSprintTable.addedAt,
      removedAt: taskSprintTable.removedAt,
    })
    .from(taskSprintTable)
    .where(eq(taskSprintTable.taskId, taskId));

  const plan = planSprintMembershipChange(memberships, nextSprintId);

  if (plan.closeSprintIds.length > 0) {
    await db
      .update(taskSprintTable)
      .set({ removedAt: now })
      .where(
        and(
          eq(taskSprintTable.taskId, taskId),
          inArray(taskSprintTable.sprintId, plan.closeSprintIds),
          isNull(taskSprintTable.removedAt),
        ),
      );
  }

  if (plan.reopenSprintId) {
    await db
      .update(taskSprintTable)
      .set({ removedAt: null, addedAt: now })
      .where(
        and(
          eq(taskSprintTable.taskId, taskId),
          eq(taskSprintTable.sprintId, plan.reopenSprintId),
        ),
      );
  }

  if (plan.insertSprintId) {
    await db
      .insert(taskSprintTable)
      .values({
        taskId,
        sprintId: plan.insertSprintId,
        addedAt: now,
        removedAt: null,
      })
      .onConflictDoUpdate({
        target: [taskSprintTable.taskId, taskSprintTable.sprintId],
        set: { removedAt: null, addedAt: now },
      });
  }
}

export default syncTaskSprintMembership;
