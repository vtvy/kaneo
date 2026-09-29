import { asc, eq } from "drizzle-orm";
import db from "../../database";
import { sprintTable } from "../../database/schema";
import { getSprintTotalsForSprints } from "./get-sprint-totals";

async function getSprintsByProject(projectId: string) {
  const sprints = await db
    .select()
    .from(sprintTable)
    .where(eq(sprintTable.projectId, projectId))
    .orderBy(asc(sprintTable.createdAt));

  const totalsBySprint = await getSprintTotalsForSprints(
    sprints.map((sprint) => sprint.id),
  );

  return sprints.map((sprint) => ({
    ...sprint,
    ...(totalsBySprint.get(sprint.id) ?? {
      totalTasks: 0,
      completedTasks: 0,
      totalPoints: 0,
      completedPoints: 0,
    }),
  }));
}

export default getSprintsByProject;
