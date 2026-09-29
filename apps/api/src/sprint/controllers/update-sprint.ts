import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";
import { assertNoSprintDateOverlap } from "./assert-no-sprint-date-overlap";

async function updateSprint({
  id,
  name,
  goal,
  startDate,
  endDate,
}: {
  id: string;
  name?: string;
  goal?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
}) {
  const existingSprint = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });

  if (!existingSprint) {
    throw new HTTPException(404, {
      message: "Sprint not found",
    });
  }

  const values: Partial<typeof sprintTable.$inferInsert> = {};

  if (name !== undefined) values.name = name;
  if (goal !== undefined) values.goal = goal;
  if (startDate !== undefined) values.startDate = startDate;
  if (endDate !== undefined) values.endDate = endDate;

  // Validate against the dates the sprint will HAVE after this update: fields
  // left undefined keep their current value. Exclude the sprint itself.
  const effectiveStartDate =
    startDate === undefined ? existingSprint.startDate : startDate;
  const effectiveEndDate =
    endDate === undefined ? existingSprint.endDate : endDate;

  await assertNoSprintDateOverlap({
    projectId: existingSprint.projectId,
    startDate: effectiveStartDate,
    endDate: effectiveEndDate,
    excludeSprintId: id,
  });

  const [updatedSprint] = await db
    .update(sprintTable)
    .set(values)
    .where(eq(sprintTable.id, id))
    .returning();

  if (!updatedSprint) {
    throw new HTTPException(500, {
      message: "Failed to update sprint",
    });
  }

  return updatedSprint;
}

export default updateSprint;
