import { describe, expect, it } from "vitest";
import {
  getDaysUntilSprintEnd,
  getSprintCompletionReport,
  getSprintEndChip,
} from "./sprint";

const now = new Date(2026, 10, 10, 15, 0, 0);

describe("getDaysUntilSprintEnd", () => {
  it("counts calendar days to the stored UTC end date", () => {
    expect(getDaysUntilSprintEnd("2026-11-10T00:00:00.000Z", now)).toBe(0);
    expect(getDaysUntilSprintEnd("2026-11-12T00:00:00.000Z", now)).toBe(2);
    expect(getDaysUntilSprintEnd("2026-11-08T00:00:00.000Z", now)).toBe(-2);
  });

  it("returns null for missing or invalid dates", () => {
    expect(getDaysUntilSprintEnd(null, now)).toBeNull();
    expect(getDaysUntilSprintEnd("not-a-date", now)).toBeNull();
  });
});

describe("getSprintEndChip", () => {
  it("flags open sprints past their end date as overdue", () => {
    expect(
      getSprintEndChip(
        { state: "future", endDate: "2026-11-09T00:00:00.000Z" },
        now,
      ),
    ).toEqual({ kind: "overdue" });
  });

  it("shows ends-today and ends-in-N within three days", () => {
    expect(
      getSprintEndChip(
        { state: "future", endDate: "2026-11-10T00:00:00.000Z" },
        now,
      ),
    ).toEqual({ kind: "endsToday" });
    expect(
      getSprintEndChip(
        { state: "future", endDate: "2026-11-13T00:00:00.000Z" },
        now,
      ),
    ).toEqual({ kind: "endsInDays", days: 3 });
  });

  it("hides the chip for far-off, undated, or completed sprints", () => {
    expect(
      getSprintEndChip(
        { state: "future", endDate: "2026-11-14T00:00:00.000Z" },
        now,
      ),
    ).toBeNull();
    expect(
      getSprintEndChip({ state: "future", endDate: null }, now),
    ).toBeNull();
    expect(
      getSprintEndChip(
        { state: "completed", endDate: "2026-11-01T00:00:00.000Z" },
        now,
      ),
    ).toBeNull();
  });
});

describe("getSprintCompletionReport", () => {
  it("splits tasks and points into done and carried over", () => {
    expect(
      getSprintCompletionReport({
        totalTasks: 8,
        completedTasks: 5,
        totalPoints: 21,
        completedPoints: 13,
      }),
    ).toEqual({
      totalTasks: 8,
      doneTasks: 5,
      carriedOverTasks: 3,
      totalPoints: 21,
      donePoints: 13,
      carriedOverPoints: 8,
      percentDone: 63,
    });
  });

  it("handles empty sprints and missing totals", () => {
    expect(getSprintCompletionReport(null)).toEqual({
      totalTasks: 0,
      doneTasks: 0,
      carriedOverTasks: 0,
      totalPoints: 0,
      donePoints: 0,
      carriedOverPoints: 0,
      percentDone: 0,
    });
  });

  it("never reports more done than total", () => {
    const report = getSprintCompletionReport({
      totalTasks: 2,
      completedTasks: 5,
      totalPoints: 3,
      completedPoints: 9,
    });
    expect(report.doneTasks).toBe(2);
    expect(report.carriedOverTasks).toBe(0);
    expect(report.carriedOverPoints).toBe(0);
    expect(report.percentDone).toBe(100);
  });
});
