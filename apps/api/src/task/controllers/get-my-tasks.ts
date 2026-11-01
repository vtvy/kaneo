import { and, asc, eq, isNull, sql } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskInvolvementTable,
  taskTable,
} from "../../database/schema";
import { readableProjectsCondition } from "../../project-rbac/readable-projects";

const priorityCaseExpr = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

// Matches the My Tasks page: a task is done when its column is final or it
// still carries the legacy "done" status; archived tasks are never open.
const openTaskExpr = sql`${columnTable.isFinal} is not true and ${taskTable.status} not in ('done', 'archived')`;

export type MyTasksScope = "assigned" | "involved";

export type MyTasksOptions = {
  /** Only unfinished tasks in active (non-archived) projects. */
  open?: boolean;
};

async function getMyTasks(
  userId: string,
  workspaceId: string,
  scope: MyTasksScope = "assigned",
  options: MyTasksOptions = {},
) {
  const workspaceCondition = and(
    eq(projectTable.workspaceId, workspaceId),
    scope === "assigned"
      ? eq(taskTable.userId, userId)
      : eq(taskInvolvementTable.userId, userId),
    // Assignment/involvement can outlive project membership; only list tasks
    // from projects the caller can still read.
    await readableProjectsCondition(userId, workspaceId),
    options.open ? isNull(projectTable.archivedAt) : undefined,
    options.open ? openTaskExpr : undefined,
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
      projectIcon: projectTable.icon,
      columnId: taskTable.columnId,
      columnName: columnTable.name,
      columnSlug: columnTable.slug,
      columnIcon: columnTable.icon,
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
