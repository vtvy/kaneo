import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, sprintTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { assertNoSprintDateOverlap } from "./assert-no-sprint-date-overlap";

async function createSprint({
  projectId,
  name,
  goal,
  startDate,
  endDate,
  currentUserId,
}: {
  projectId: string;
  name: string;
  goal?: string;
  startDate?: Date;
  endDate?: Date;
  currentUserId: string;
}) {
  const [project] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  await assertNoSprintDateOverlap({
    projectId,
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  });

  const [createdSprint] = await db
    .insert(sprintTable)
    .values({
      projectId,
      name,
      goal: goal || null,
      startDate: startDate || null,
      endDate: endDate || null,
      state: "future",
    })
    .returning();

  if (!createdSprint) {
    throw new HTTPException(500, {
      message: "Failed to create sprint",
    });
  }

  await publishEvent("sprint.created", {
    ...createdSprint,
    sprintId: createdSprint.id,
    projectId: createdSprint.projectId,
    userId: currentUserId,
    type: "created",
    content: null,
  });

  return createdSprint;
}

export default createSprint;
