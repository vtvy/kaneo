import { and, asc, eq, sql } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskInvolvementTable,
  taskTable,
} from "../../database/schema";

const priorityCaseExpr = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

export type MyTasksScope = "assigned" | "involved";

async function getMyTasks(
  userId: string,
  workspaceId: string,
  scope: MyTasksScope = "assigned",
) {
  const workspaceCondition = and(
    eq(projectTable.workspaceId, workspaceId),
    scope === "assigned"
      ? eq(taskTable.userId, userId)
      : eq(taskInvolvementTable.userId, userId),
  );

  const baseQuery = db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      status: taskTable.status,
      priority: taskTable.priority,
      points: taskTable.points,
      dueDate: taskTable.dueDate,
      startDate: taskTable.startDate,
      projectId: taskTable.projectId,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
      columnId: taskTable.columnId,
      columnName: columnTable.name,
      columnSlug: columnTable.slug,
      columnIsFinal: columnTable.isFinal,
      createdAt: taskTable.createdAt,
      position: taskTable.position,
      userId: taskTable.userId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id));

  const query =
    scope === "involved"
      ? baseQuery.innerJoin(
          taskInvolvementTable,
          eq(taskInvolvementTable.taskId, taskTable.id),
        )
      : baseQuery;

  const tasks = await query
    .where(workspaceCondition)
    .orderBy(
      sql`${taskTable.dueDate} asc nulls last`,
      sql`${priorityCaseExpr} desc`,
      asc(taskTable.createdAt),
    );

  return tasks;
}

export default getMyTasks;
