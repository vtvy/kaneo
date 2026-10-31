import { describe, expect, it } from "vitest";
import { buildWeek } from "./build-week";
import { getDayPart } from "./day-part";

const now = new Date(2026, 9, 14, 15, 30);

function task(id: string, dueDate: Date | null) {
  return { id, dueDate: dueDate ? dueDate.toISOString() : null };
}

describe("buildWeek", () => {
  it("returns seven days centred on today", () => {
    const week = buildWeek([], now);

    expect(week).toHaveLength(7);
    expect(week.map((day) => day.date.getDate())).toEqual([
      11, 12, 13, 14, 15, 16, 17,
    ]);
    expect(week.filter((day) => day.isToday)).toHaveLength(1);
    expect(week[3].isToday).toBe(true);
    expect(week.slice(0, 3).every((day) => day.isPast)).toBe(true);
    expect(week.slice(3).some((day) => day.isPast)).toBe(false);
  });

  it("places tasks on their due day and drops the rest", () => {
    const week = buildWeek(
      [
        task("today", new Date(2026, 9, 14, 9)),
        task("missed", new Date(2026, 9, 12, 23)),
        task("later", new Date(2026, 9, 30)),
        task("undated", null),
      ],
      now,
    );

    expect(week[3].tasks.map((t) => t.id)).toEqual(["today"]);
    expect(week[1].tasks.map((t) => t.id)).toEqual(["missed"]);
    expect(week.flatMap((day) => day.tasks)).toHaveLength(2);
  });
});

describe("getDayPart", () => {
  it("splits the day into morning, afternoon and evening", () => {
    expect(getDayPart(new Date(2026, 0, 1, 5))).toBe("morning");
    expect(getDayPart(new Date(2026, 0, 1, 12))).toBe("afternoon");
    expect(getDayPart(new Date(2026, 0, 1, 18))).toBe("evening");
    expect(getDayPart(new Date(2026, 0, 1, 2))).toBe("evening");
  });
});
