import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../../database";
import {
  columnTable,
  sprintTable,
  taskTable,
  userTable,
} from "../../database/schema";

const reporterUser = alias(userTable, "reporter_user");

/**
 * Returns a flat list of every task in a project for the backlog table.
 * Tasks with no status, no column, or no sprint are included.
 */
function getAllProjectTasks(projectId: string) {
  return db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      priority: taskTable.priority,
      points: taskTable.points,
      sprintId: taskTable.sprintId,
      sprintName: sprintTable.name,
      columnId: taskTable.columnId,
      columnName: columnTable.name,
      columnColor: columnTable.color,
      assigneeId: taskTable.userId,
      assigneeName: userTable.name,
      reporterId: taskTable.reporterId,
      reporterName: reporterUser.name,
      reporterImage: reporterUser.image,
      dueDate: taskTable.dueDate,
      createdAt: taskTable.createdAt,
      position: taskTable.position,
    })
    .from(taskTable)
    .leftJoin(sprintTable, eq(taskTable.sprintId, sprintTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(reporterUser, eq(taskTable.reporterId, reporterUser.id))
    .where(eq(taskTable.projectId, projectId))
    .orderBy(asc(taskTable.number), asc(taskTable.createdAt));
}

export default getAllProjectTasks;
