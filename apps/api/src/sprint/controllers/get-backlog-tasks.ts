import { and, asc, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { taskTable, userTable } from "../../database/schema";

function getBacklogTasks(projectId: string) {
  return db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      description: taskTable.description,
      status: taskTable.status,
      priority: taskTable.priority,
      points: taskTable.points,
      startDate: taskTable.startDate,
      dueDate: taskTable.dueDate,
      position: taskTable.position,
      createdAt: taskTable.createdAt,
      userId: taskTable.userId,
      assigneeName: userTable.name,
      assigneeId: userTable.id,
      projectId: taskTable.projectId,
      columnId: taskTable.columnId,
      sprintId: taskTable.sprintId,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(and(eq(taskTable.projectId, projectId), isNull(taskTable.sprintId)))
    .orderBy(asc(taskTable.position));
}

export default getBacklogTasks;
