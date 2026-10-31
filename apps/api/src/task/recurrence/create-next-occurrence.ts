import { and, asc, eq, isNotNull } from "drizzle-orm";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import createTask from "../controllers/create-task";
import { taskIsCompleted } from "../task-is-completed";
import { assertAssigneeInWorkspace } from "../validate-task-fields";
import { nextOccurrenceDates } from "./next-occurrence-date";

// Creates the next task of a recurring series once the task sits in a final
// column. The copy lands in the project's first open column (or no status),
// outside any sprint, with its dates moved one step from the due date.
export async function createNextOccurrence(
  taskId: string,
  currentUserId: string | null | undefined,
) {
  const completedAt = new Date();

  // Moving the rule off the completed task is the claim: a concurrent
  // completion waits on the row lock, then finds no rule left, so each
  // completion creates one next task. The row is read before the update
  // because RETURNING would only show the cleared rule.
  const claimed = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(taskTable)
      .where(
        and(
          eq(taskTable.id, taskId),
          isNotNull(taskTable.recurrence),
          taskIsCompleted,
        ),
      )
      .for("update")
      .limit(1);
    if (!row) return undefined;

    await tx
      .update(taskTable)
      .set({ recurrence: null })
      .where(eq(taskTable.id, row.id));
    return row;
  });
  const recurrence = claimed?.recurrence;
  if (!claimed || !recurrence) return null;

  try {
    const [openColumn] = await db
      .select({ slug: columnTable.slug })
      .from(columnTable)
      .where(
        and(
          eq(columnTable.projectId, claimed.projectId),
          eq(columnTable.isFinal, false),
        ),
      )
      .orderBy(asc(columnTable.position))
      .limit(1);

    // An assignee who left the workspace must not stop the series.
    let assigneeId = claimed.userId ?? undefined;
    try {
      await assertAssigneeInWorkspace(assigneeId, claimed.projectId);
    } catch {
      assigneeId = undefined;
    }

    const dates = nextOccurrenceDates(claimed, recurrence, completedAt);
    const next = await createTask({
      projectId: claimed.projectId,
      currentUserId: currentUserId || claimed.reporterId || "",
      userId: assigneeId,
      title: claimed.title,
      status: openColumn?.slug ?? null,
      startDate: dates.startDate ?? undefined,
      dueDate: dates.dueDate,
      description: claimed.description ?? "",
      priority: claimed.priority ?? "no-priority",
      points: claimed.points,
      recurrence,
    });

    // Clients refetched the completed task on its status change, before its
    // rule moved, so they still show it as repeating.
    await publishEvent("task.updated", {
      taskId: claimed.id,
      projectId: claimed.projectId,
      title: claimed.title,
      status: claimed.status,
      userId: currentUserId,
    });

    return next;
  } catch (error) {
    // Give the rule back so the series is not silently lost.
    await db
      .update(taskTable)
      .set({ recurrence })
      .where(eq(taskTable.id, claimed.id));
    throw error;
  }
}
