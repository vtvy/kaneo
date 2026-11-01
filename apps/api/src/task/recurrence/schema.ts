import * as v from "valibot";

export const RECURRENCE_FREQUENCIES = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;

// Intl.supportedValuesOf lists canonical zones only; browsers may report
// aliases such as Etc/UTC, which are just as usable.
function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const taskRecurrenceSchema = v.pipe(
  v.object({
    frequency: v.picklist(RECURRENCE_FREQUENCIES),
    // Repeat every this many days, weeks, months, or years.
    interval: v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(99)),
    // Weekly rules only: the days to repeat on, 0 for Sunday to 6 for
    // Saturday. Without them, a weekly rule repeats on the due date's weekday.
    weekdays: v.optional(
      v.pipe(
        v.array(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(6))),
        v.minLength(1),
        v.maxLength(7),
        v.check(
          (days) => new Set(days).size === days.length,
          "Weekdays must be unique",
        ),
      ),
    ),
    // IANA time zone that keeps the next due date on the same local day.
    timeZone: v.pipe(v.string(), v.check(isTimeZone, "Unknown time zone")),
  }),
  v.check(
    (rule) => !rule.weekdays || rule.frequency === "weekly",
    "Weekdays only apply to weekly rules",
  ),
);

export type TaskRecurrence = v.InferOutput<typeof taskRecurrenceSchema>;
