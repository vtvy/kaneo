import { and, desc, eq, gte, isNotNull, lte, ne, sql } from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  sprintTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { getSprintTotalsForSprints } from "../../sprint/controllers/get-sprint-totals";

export type WorkspaceDashboardStats = {
  total: number;
  open: number;
  completed: number;
  overdue: number;
};

export type WorkspaceDashboardMember = {
  userId: string;
  name: string;
  open: number;
  overdue: number;
  completed: number;
  total: number;
};

export type WorkspaceDashboardSprint = {
  id: string;
  name: string;
  endDate: Date | null;
  totalTasks: number;
  completedTasks: number;
  totalPoints: number;
  completedPoints: number;
};

export type WorkspaceDashboardProject = {
  id: string;
  name: string;
  slug: string;
  totalTasks: number;
  completedTasks: number;
};

export type WorkspaceDashboard = {
  stats: WorkspaceDashboardStats;
  members: WorkspaceDashboardMember[];
  activeSprints: WorkspaceDashboardSprint[];
  projects: WorkspaceDashboardProject[];
};

// A task is COMPLETED when its column is final (columnTable.isFinal = true).
// OVERDUE when it has a dueDate in the past and is not completed. OPEN when it
// is not completed. "now" is computed in JS and passed as a parameter so the
// overdue comparison is deterministic across the queries below.
async function getWorkspaceDashboard(
  workspaceId: string,
): Promise<WorkspaceDashboard> {
  const now = new Date();

  const completedExpr = sql`${columnTable.isFinal} = true`;
  const overdueExpr = sql`${columnTable.isFinal} is not true and ${taskTable.dueDate} is not null and ${taskTable.dueDate} < ${now}`;
  const openExpr = sql`${columnTable.isFinal} is not true`;

  // Workspace-wide stats across every task in the workspace's projects.
  const [statsRow] = await db
    .select({
      total: sql<number>`count(*)`,
      open: sql<number>`count(*) filter (where ${openExpr})`,
      completed: sql<number>`count(*) filter (where ${completedExpr})`,
      overdue: sql<number>`count(*) filter (where ${overdueExpr})`,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(eq(projectTable.workspaceId, workspaceId));

  const stats: WorkspaceDashboardStats = {
    total: Number(statsRow?.total ?? 0),
    open: Number(statsRow?.open ?? 0),
    completed: Number(statsRow?.completed ?? 0),
    overdue: Number(statsRow?.overdue ?? 0),
  };

  // Per-assignee breakdown. Null assignees are excluded; sorted by open desc
  // then total desc.
  const memberRows = await db
    .select({
      userId: taskTable.userId,
      name: userTable.name,
      open: sql<number>`count(*) filter (where ${openExpr})`,
      overdue: sql<number>`count(*) filter (where ${overdueExpr})`,
      completed: sql<number>`count(*) filter (where ${completedExpr})`,
      total: sql<number>`count(*)`,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNotNull(taskTable.userId),
      ),
    )
    .groupBy(taskTable.userId, userTable.name)
    .orderBy(
      desc(sql`count(*) filter (where ${openExpr})`),
      desc(sql`count(*)`),
    );

  const members: WorkspaceDashboardMember[] = memberRows.map((row) => ({
    userId: row.userId as string,
    name: row.name,
    open: Number(row.open ?? 0),
    overdue: Number(row.overdue ?? 0),
    completed: Number(row.completed ?? 0),
    total: Number(row.total ?? 0),
  }));

  // Per-project task counts for projects in this workspace.
  const projectRows = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      slug: projectTable.slug,
      totalTasks: sql<number>`count(${taskTable.id})`,
      completedTasks: sql<number>`count(${taskTable.id}) filter (where ${completedExpr})`,
    })
    .from(projectTable)
    .leftJoin(taskTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(columnTable, eq(taskTable.columnId, columnTable.id))
    .where(eq(projectTable.workspaceId, workspaceId))
    .groupBy(projectTable.id, projectTable.name, projectTable.slug)
    .orderBy(projectTable.name);

  const projects: WorkspaceDashboardProject[] = projectRows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    totalTasks: Number(row.totalTasks ?? 0),
    completedTasks: Number(row.completedTasks ?? 0),
  }));

  // "Current" sprints whose project belongs to this workspace. A sprint is
  // current (Azure-style, derived by date) when it is not completed and TODAY
  // falls within [startDate, endDate]. "now" is computed in JS above and passed
  // as a parameter so the comparison is deterministic. Totals are reused from
  // the sprint controller.
  const activeSprintRows = await db
    .select({
      id: sprintTable.id,
      name: sprintTable.name,
      endDate: sprintTable.endDate,
    })
    .from(sprintTable)
    .innerJoin(projectTable, eq(sprintTable.projectId, projectTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        ne(sprintTable.state, "completed"),
        lte(sprintTable.startDate, now),
        gte(sprintTable.endDate, now),
      ),
    )
    .orderBy(sprintTable.endDate);

  const totalsBySprint = await getSprintTotalsForSprints(
    activeSprintRows.map((sprint) => sprint.id),
  );

  const activeSprints: WorkspaceDashboardSprint[] = activeSprintRows.map(
    (sprint) => {
      const totals = totalsBySprint.get(sprint.id) ?? {
        totalTasks: 0,
        completedTasks: 0,
        totalPoints: 0,
        completedPoints: 0,
      };
      return {
        id: sprint.id,
        name: sprint.name,
        endDate: sprint.endDate,
        totalTasks: totals.totalTasks,
        completedTasks: totals.completedTasks,
        totalPoints: totals.totalPoints,
        completedPoints: totals.completedPoints,
      };
    },
  );

  return { stats, members, activeSprints, projects };
}

export default getWorkspaceDashboard;
export { getWorkspaceDashboard };
