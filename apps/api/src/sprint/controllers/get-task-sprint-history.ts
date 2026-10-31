import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { sprintTable, taskSprintTable } from "../../database/schema";

function getTaskSprintHistory(taskId: string) {
  return db
    .select({
      sprintId: sprintTable.id,
      name: sprintTable.name,
      state: sprintTable.state,
      addedAt: taskSprintTable.addedAt,
      removedAt: taskSprintTable.removedAt,
    })
    .from(taskSprintTable)
    .innerJoin(sprintTable, eq(taskSprintTable.sprintId, sprintTable.id))
    .where(eq(taskSprintTable.taskId, taskId))
    .orderBy(asc(taskSprintTable.addedAt));
}

export default getTaskSprintHistory;
