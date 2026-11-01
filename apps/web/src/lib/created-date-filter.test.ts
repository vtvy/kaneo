import { describe, expect, it } from "vitest";
import {
  matchesAnyCreatedDateFilter,
  matchesCreatedDateFilter,
} from "./created-date-filter";

// Wednesday, 2026-10-14 12:00 local time.
const now = new Date(2026, 9, 14, 12, 0, 0);

describe("matchesCreatedDateFilter", () => {
  it("matches createdToday only within the current day", () => {
    expect(
      matchesCreatedDateFilter(
        new Date(2026, 9, 14, 0, 5),
        "createdToday",
        1,
        now,
      ),
    ).toBe(true);
    expect(
      matchesCreatedDateFilter(
        new Date(2026, 9, 13, 23, 59),
        "createdToday",
        1,
        now,
      ),
    ).toBe(false);
  });

  it("respects weekStartsOn for this week and last week", () => {
    // Monday 2026-10-12 is in this week when weeks start on Monday.
    const monday = new Date(2026, 9, 12, 9, 0);
    expect(matchesCreatedDateFilter(monday, "createdThisWeek", 1, now)).toBe(
      true,
    );
    // Sunday 2026-10-11 belongs to last week (Mon start) but this week (Sun start).
    const sunday = new Date(2026, 9, 11, 9, 0);
    expect(matchesCreatedDateFilter(sunday, "createdThisWeek", 1, now)).toBe(
      false,
    );
    expect(matchesCreatedDateFilter(sunday, "createdLastWeek", 1, now)).toBe(
      true,
    );
    expect(matchesCreatedDateFilter(sunday, "createdThisWeek", 0, now)).toBe(
      true,
    );
  });

  it("includes the last 30 days counting today", () => {
    expect(
      matchesCreatedDateFilter(
        new Date(2026, 8, 15, 0, 0),
        "createdLast30Days",
        1,
        now,
      ),
    ).toBe(true);
    expect(
      matchesCreatedDateFilter(
        new Date(2026, 8, 14, 23, 59),
        "createdLast30Days",
        1,
        now,
      ),
    ).toBe(false);
  });

  it("accepts ISO strings and rejects missing, invalid or unknown input", () => {
    expect(
      matchesCreatedDateFilter(
        new Date(2026, 9, 14, 8).toISOString(),
        "createdToday",
        1,
        now,
      ),
    ).toBe(true);
    expect(matchesCreatedDateFilter(null, "createdToday", 1, now)).toBe(false);
    expect(matchesCreatedDateFilter("not-a-date", "createdToday", 1, now)).toBe(
      false,
    );
    expect(matchesCreatedDateFilter(now, "unknown", 1, now)).toBe(false);
  });
});

describe("matchesAnyCreatedDateFilter", () => {
  it("passes everything when no filter is selected", () => {
    expect(matchesAnyCreatedDateFilter(null, [], 1, now)).toBe(true);
    expect(matchesAnyCreatedDateFilter(null, null, 1, now)).toBe(true);
  });

  it("matches when any selected filter matches", () => {
    const lastWeek = new Date(2026, 9, 6, 9, 0);
    expect(
      matchesAnyCreatedDateFilter(
        lastWeek,
        ["createdToday", "createdLastWeek"],
        1,
        now,
      ),
    ).toBe(true);
    expect(
      matchesAnyCreatedDateFilter(lastWeek, ["createdToday"], 1, now),
    ).toBe(false);
  });
});
