import type { Sprint } from "@/types/sprint";

/**
 * A sprint's "current" status is derived from the date, not a stored/manual
 * state. A sprint is CURRENT when it is not completed, has both a start and an
 * end date, and today falls within that range (inclusive). Sprint date ranges
 * within a project may not overlap, so the current sprint is unambiguous.
 */
export function isCurrentSprint(
  sprint: Sprint,
  now: Date = new Date(),
): boolean {
  if (sprint.state === "completed") return false;
  if (!sprint.startDate || !sprint.endDate) return false;

  const start = new Date(sprint.startDate);
  const end = new Date(sprint.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  const time = now.getTime();
  return start.getTime() <= time && time <= end.getTime();
}

/** Returns the current sprint (by date) for the given list, or undefined. */
export function getCurrentSprint(
  sprints: Sprint[] | undefined,
  now: Date = new Date(),
): Sprint | undefined {
  return sprints?.find((sprint) => isCurrentSprint(sprint, now));
}
