import db from "../../database";
import { taskInvolvementTable } from "../../database/schema";

export type InvolvementReason = "assignee" | "reporter" | "former_assignee";

/**
 * Record that a user is involved with a task. Idempotent: existing rows are kept.
 */
export async function recordTaskInvolvement(
  taskId: string,
  userId: string | null | undefined,
  reason: InvolvementReason,
) {
  if (!userId) return;

  await db
    .insert(taskInvolvementTable)
    .values({
      taskId,
      userId,
      reason,
    })
    .onConflictDoNothing({
      target: [taskInvolvementTable.taskId, taskInvolvementTable.userId],
    });
}

/**
 * When assignee changes: keep previous assignee discoverable, record new assignee.
 */
export async function recordAssigneeHandoff({
  taskId,
  previousAssigneeId,
  nextAssigneeId,
}: {
  taskId: string;
  previousAssigneeId: string | null | undefined;
  nextAssigneeId: string | null | undefined;
}) {
  if (previousAssigneeId && previousAssigneeId !== nextAssigneeId) {
    await recordTaskInvolvement(taskId, previousAssigneeId, "former_assignee");
  }

  if (nextAssigneeId) {
    await recordTaskInvolvement(taskId, nextAssigneeId, "assignee");
  }
}
