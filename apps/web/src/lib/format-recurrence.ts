import type { TFunction } from "i18next";
import type { TaskRecurrence } from "@/types/task";

// 2026-10-04 is a Sunday, so adding a weekday number gives that weekday.
const SUNDAY = Date.UTC(2026, 9, 4);

export function formatWeekday(
  day: number,
  locale: string,
  width: "long" | "short" | "narrow" = "long",
) {
  return new Intl.DateTimeFormat(locale, {
    weekday: width,
    timeZone: "UTC",
  }).format(new Date(SUNDAY + day * 86_400_000));
}

export function formatRecurrencePattern(
  t: TFunction,
  frequency: TaskRecurrence["frequency"],
) {
  switch (frequency) {
    case "daily":
      return t("tasks:popover.recurrence.pattern.daily");
    case "weekly":
      return t("tasks:popover.recurrence.pattern.weekly");
    case "monthly":
      return t("tasks:popover.recurrence.pattern.monthly");
    case "yearly":
      return t("tasks:popover.recurrence.pattern.yearly");
  }
}

// Intervals above one always use the plural unit, so no plural keys needed.
export function formatRecurrenceUnit(
  t: TFunction,
  frequency: TaskRecurrence["frequency"],
) {
  switch (frequency) {
    case "daily":
      return t("tasks:popover.recurrence.unit.days");
    case "weekly":
      return t("tasks:popover.recurrence.unit.weeks");
    case "monthly":
      return t("tasks:popover.recurrence.unit.months");
    case "yearly":
      return t("tasks:popover.recurrence.unit.years");
  }
}

export function formatRecurrence(
  t: TFunction,
  recurrence: Pick<TaskRecurrence, "frequency" | "interval" | "weekdays">,
  locale: string,
) {
  const rule =
    recurrence.interval === 1
      ? formatRecurrencePattern(t, recurrence.frequency)
      : t("tasks:recurrence.everyInterval", {
          interval: recurrence.interval,
          unit: formatRecurrenceUnit(t, recurrence.frequency),
        });
  if (recurrence.frequency !== "weekly" || !recurrence.weekdays?.length)
    return rule;

  const days = [...recurrence.weekdays]
    .sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
    .map((day) => formatWeekday(day, locale, "short"));
  return t("tasks:recurrence.onDays", { rule, days: days.join(", ") });
}

// Turning repeat on starts weekly on the due date's weekday.
export function defaultRecurrence(): TaskRecurrence {
  return {
    frequency: "weekly",
    interval: 1,
    // Keeps the next due date on the same local day across DST changes.
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
}
