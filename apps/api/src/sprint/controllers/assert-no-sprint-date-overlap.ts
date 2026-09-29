import { and, eq, gte, isNotNull, lte, ne } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable } from "../../database/schema";

/**
 * Sprint date ranges within one project must not overlap so the date-derived
 * "current" sprint is unambiguous. Two ranges overlap when
 * existing.start <= new.end AND new.start <= existing.end.
 *
 * Only non-completed sprints are considered (completed sprints are history and
 * may sit anywhere). The check is skipped entirely when either date is null —
 * a sprint without a full range can never be "current" and so cannot collide.
 * When updating, pass `excludeSprintId` so the sprint is not compared to itself.
 */
async function assertNoSprintDateOverlap({
  projectId,
  startDate,
  endDate,
  excludeSprintId,
}: {
  projectId: string;
  startDate?: Date | null;
  endDate?: Date | null;
  excludeSprintId?: string;
}): Promise<void> {
  if (startDate && endDate && startDate.getTime() > endDate.getTime()) {
    throw new HTTPException(400, {
      message: "Sprint end date must be on or after the start date.",
    });
  }

  if (!startDate || !endDate) {
    return;
  }

  const conditions = [
    eq(sprintTable.projectId, projectId),
    ne(sprintTable.state, "completed"),
    isNotNull(sprintTable.startDate),
    isNotNull(sprintTable.endDate),
    // existing.start <= new.end
    lte(sprintTable.startDate, endDate),
    // new.start <= existing.end  (equivalently existing.end >= new.start)
    gte(sprintTable.endDate, startDate),
  ];

  if (excludeSprintId) {
    conditions.push(ne(sprintTable.id, excludeSprintId));
  }

  const overlapping = await db.query.sprintTable.findFirst({
    where: and(...conditions),
  });

  if (overlapping) {
    throw new HTTPException(400, {
      message: `Sprint dates overlap an existing sprint "${overlapping.name}" in this project. Sprint date ranges may not overlap.`,
    });
  }
}

export { assertNoSprintDateOverlap };
export default assertNoSprintDateOverlap;
