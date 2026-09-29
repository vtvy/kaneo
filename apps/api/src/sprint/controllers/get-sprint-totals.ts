import { eq, inArray, sql } from "drizzle-orm";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";

export type SprintTotals = {
  totalTasks: number;
  completedTasks: number;
  totalPoints: number;
  completedPoints: number;
};

const emptyTotals = (): SprintTotals => ({
  totalTasks: 0,
  completedTasks: 0,
  totalPoints: 0,
  completedPoints: 0,
});

// Aggregate per-sprint task counts and story-point sums. A task is considered
// completed when its column is final (columnTable.isFinal). Null points count
// as 0 in the sums.
async function getSprintTotalsForSprints(
  sprintIds: string[],
): Promise<Map<string, SprintTotals>> {
  const totalsBySprint = new Map<string, SprintTotals>();

  if (sprintIds.length === 0) {
    return totalsBySprint;
  }

  const rows = await db
    .select({
      sprintId: taskTable.sprintId,
      totalTasks: sql<number>`count(*)`,
      completedTasks: sql<number>`count(*) filter (where ${columnTable.isFinal} = true)`,
      totalPoints: sql<number>`coalesce(sum(coalesce(${taskTable.points}, 0)), 0)`,
      completedPoints: sql<number>`coalesce(sum(coalesce(${taskTable.points}, 0)) filter (where ${columnTable.isFinal} = true), 0)`,
    })
    .from(taskTable)
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(inArray(taskTable.sprintId, sprintIds))
    .groupBy(taskTable.sprintId);

  for (const sprintId of sprintIds) {
    totalsBySprint.set(sprintId, emptyTotals());
  }

  for (const row of rows) {
    if (!row.sprintId) continue;
    totalsBySprint.set(row.sprintId, {
      totalTasks: Number(row.totalTasks ?? 0),
      completedTasks: Number(row.completedTasks ?? 0),
      totalPoints: Number(row.totalPoints ?? 0),
      completedPoints: Number(row.completedPoints ?? 0),
    });
  }

  return totalsBySprint;
}

async function getSprintTotals(sprintId: string): Promise<SprintTotals> {
  const totals = await getSprintTotalsForSprints([sprintId]);
  return totals.get(sprintId) ?? emptyTotals();
}

export { getSprintTotals, getSprintTotalsForSprints };
