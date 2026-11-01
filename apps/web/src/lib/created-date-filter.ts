import {
  addDays,
  endOfDay,
  endOfWeek,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  subWeeks,
} from "date-fns";

export const CREATED_DATE_FILTER_VALUES = {
  createdToday: "createdToday",
  createdThisWeek: "createdThisWeek",
  createdLastWeek: "createdLastWeek",
  createdLast30Days: "createdLast30Days",
} as const;

export type CreatedDateFilterValue =
  (typeof CREATED_DATE_FILTER_VALUES)[keyof typeof CREATED_DATE_FILTER_VALUES];

export const CREATED_DATE_FILTER_OPTIONS: CreatedDateFilterValue[] = [
  CREATED_DATE_FILTER_VALUES.createdToday,
  CREATED_DATE_FILTER_VALUES.createdThisWeek,
  CREATED_DATE_FILTER_VALUES.createdLastWeek,
  CREATED_DATE_FILTER_VALUES.createdLast30Days,
];

export function matchesCreatedDateFilter(
  createdAt: string | Date | null | undefined,
  filter: string,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1,
  now = new Date(),
): boolean {
  if (!createdAt) return false;
  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;

  switch (filter) {
    case CREATED_DATE_FILTER_VALUES.createdToday: {
      return isWithinInterval(created, {
        start: startOfDay(now),
        end: endOfDay(now),
      });
    }
    case CREATED_DATE_FILTER_VALUES.createdThisWeek: {
      return isWithinInterval(created, {
        start: startOfWeek(now, { weekStartsOn }),
        end: endOfWeek(now, { weekStartsOn }),
      });
    }
    case CREATED_DATE_FILTER_VALUES.createdLastWeek: {
      const lastWeek = subWeeks(now, 1);
      return isWithinInterval(created, {
        start: startOfWeek(lastWeek, { weekStartsOn }),
        end: endOfWeek(lastWeek, { weekStartsOn }),
      });
    }
    case CREATED_DATE_FILTER_VALUES.createdLast30Days: {
      return isWithinInterval(created, {
        start: startOfDay(addDays(now, -29)),
        end: endOfDay(now),
      });
    }
    default:
      return false;
  }
}

export function matchesAnyCreatedDateFilter(
  createdAt: string | Date | null | undefined,
  filters: string[] | null | undefined,
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1,
  now = new Date(),
): boolean {
  if (!filters || filters.length === 0) return true;
  return filters.some((filter) =>
    matchesCreatedDateFilter(createdAt, filter, weekStartsOn, now),
  );
}
