import { eq, inArray } from "drizzle-orm";
import db from "../database";
import { projectTable, taskTable } from "../database/schema";
import syncTaskSprintMembership from "../sprint/controllers/sync-task-sprint-membership";

/** All sprint entry points move a work item and its descendants together. */
export async function assignWorkItemSprint(
  taskId: string,
  projectId: string,
  sprintId: string | null,
) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .for("update");
    const items = await tx
      .select()
      .from(taskTable)
      .where(eq(taskTable.projectId, projectId));
    const ids = new Set([taskId]);
    for (let pass = 0; pass < items.length; pass++) {
      const before = ids.size;
      for (const item of items)
        if (item.parentId && ids.has(item.parentId)) ids.add(item.id);
      if (ids.size === before) break;
    }
    const updated = await tx
      .update(taskTable)
      .set({ sprintId })
      .where(inArray(taskTable.id, [...ids]))
      .returning();
    for (const id of ids) await syncTaskSprintMembership(id, sprintId, tx);
    return updated.find((item) => item.id === taskId);
  });
}
