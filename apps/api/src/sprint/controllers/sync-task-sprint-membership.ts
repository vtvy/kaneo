import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../../database";
import { taskSprintTable } from "../../database/schema";
import { planSprintMembershipChange } from "../sprint-membership";

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// Records the task's move into `nextSprintId` (null = backlog) in the
// task_sprint history: closes the open row, then reopens or inserts the next.
// Pass a transaction as `executor` to make the change part of it.
async function syncTaskSprintMembership(
  taskId: string,
  nextSprintId: string | null,
  executor: Executor = db,
) {
  const now = new Date();
  const memberships = await executor
    .select({
      sprintId: taskSprintTable.sprintId,
      addedAt: taskSprintTable.addedAt,
      removedAt: taskSprintTable.removedAt,
    })
    .from(taskSprintTable)
    .where(eq(taskSprintTable.taskId, taskId));

  const plan = planSprintMembershipChange(memberships, nextSprintId);

  if (plan.closeSprintIds.length > 0) {
    await executor
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
    await executor
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
    await executor
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
