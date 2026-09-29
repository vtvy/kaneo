import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../../database";
import {
  projectMemberTable,
  projectTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";

async function canSeeAllWorkspaceProjects(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const [user] = await db
    .select({ role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (user?.role === "admin") {
    return true;
  }

  const [membership] = await db
    .select({ role: workspaceUserTable.role })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .limit(1);

  return membership?.role === "owner" || membership?.role === "admin";
}

async function getProjects(
  workspaceId: string,
  userId: string,
  includeArchived = false,
) {
  const projects = await db.query.projectTable.findMany({
    where: includeArchived
      ? eq(projectTable.workspaceId, workspaceId)
      : and(
          eq(projectTable.workspaceId, workspaceId),
          isNull(projectTable.archivedAt),
        ),
    with: {
      tasks: true,
    },
  });

  const seeAll = await canSeeAllWorkspaceProjects(userId, workspaceId);

  let visible = projects;
  if (!seeAll) {
    if (projects.length === 0) {
      return [];
    }

    const memberRows = await db
      .select({ projectId: projectMemberTable.projectId })
      .from(projectMemberTable)
      .where(
        and(
          eq(projectMemberTable.userId, userId),
          inArray(
            projectMemberTable.projectId,
            projects.map((p) => p.id),
          ),
        ),
      );

    const allowed = new Set(memberRows.map((row) => row.projectId));
    visible = projects.filter((project) => allowed.has(project.id));
  }

  const projectsWithStatistics = visible.map((project) => {
    const totalTasks = project.tasks.length;
    const completedTasks = project.tasks.filter(
      (task) => task.status === "done",
    ).length;
    const completionPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const dueDate = project.tasks.reduce((earliest: Date | null, task) => {
      if (!task.dueDate) return earliest;
      if (!earliest || task.dueDate < earliest) return task.dueDate;
      return earliest;
    }, null);

    return {
      ...project,
      statistics: {
        completionPercentage,
        totalTasks,
        dueDate,
      },
      columns: [],
    };
  });

  return projectsWithStatistics;
}

export default getProjects;
