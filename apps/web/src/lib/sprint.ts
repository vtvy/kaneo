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

/**
 * Calendar days from `now` until the sprint's end date (negative = past due).
 * End dates are stored as UTC-midnight calendar dates, so the UTC calendar
 * date is compared against the local calendar date; otherwise users west of
 * UTC would see the sprint end a day early.
 */
export function getDaysUntilSprintEnd(
  endDate: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const endDay = Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  );
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((endDay - today) / 86_400_000);
}

export type SprintEndChipState =
  | { kind: "overdue" }
  | { kind: "endsToday" }
  | { kind: "endsInDays"; days: number };

/** Chip shown on open sprints that are past due or end within 3 days. */
export function getSprintEndChip(
  sprint: Pick<Sprint, "state" | "endDate">,
  now: Date = new Date(),
): SprintEndChipState | null {
  if (sprint.state === "completed") return null;
  const days = getDaysUntilSprintEnd(sprint.endDate, now);
  if (days === null || days > 3) return null;
  if (days < 0) return { kind: "overdue" };
  if (days === 0) return { kind: "endsToday" };
  return { kind: "endsInDays", days };
}

export type SprintTotals = {
  totalTasks: number;
  completedTasks: number;
  totalPoints: number;
  completedPoints: number;
};

export type SprintCompletionReport = {
  totalTasks: number;
  doneTasks: number;
  carriedOverTasks: number;
  totalPoints: number;
  donePoints: number;
  carriedOverPoints: number;
  percentDone: number;
};

/**
 * Done vs carried-over split for a sprint completion. Totals are captured by
 * the API before carry-over, so anything not done was carried over.
 */
export function getSprintCompletionReport(
  totals: Partial<SprintTotals> | null | undefined,
): SprintCompletionReport {
  const count = (value: number | undefined) =>
    Math.max(0, Number.isFinite(value) ? Number(value) : 0);
  const totalTasks = count(totals?.totalTasks);
  const doneTasks = Math.min(count(totals?.completedTasks), totalTasks);
  const totalPoints = count(totals?.totalPoints);
  const donePoints = Math.min(count(totals?.completedPoints), totalPoints);

  return {
    totalTasks,
    doneTasks,
    carriedOverTasks: totalTasks - doneTasks,
    totalPoints,
    donePoints,
    carriedOverPoints: totalPoints - donePoints,
    percentDone:
      totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
  };
}
