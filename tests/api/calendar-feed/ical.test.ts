import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  escapeText,
  foldLine,
} from "../../../apps/api/src/calendar-feed/ical";
import {
  CALENDAR_FEED_TOKEN_PATTERN,
  generateCalendarFeedToken,
  hashCalendarFeedToken,
} from "../../../apps/api/src/calendar-feed/token";

const task: Parameters<typeof buildCalendar>[0]["tasks"][number] = {
  id: "task-1",
  title: "Deploy",
  startDate: null,
  dueDate: new Date("2026-09-23T00:00:00Z"),
  createdAt: new Date("2026-09-01T12:00:00Z"),
  updatedAt: new Date("2026-09-22T10:30:00Z"),
};
const calendar = (tasks = [task], timeZone = "UTC", name = "Changes") =>
  buildCalendar({ name, timeZone, tasks });

describe("escapeText", () => {
  it("escapes backslashes, commas, semicolons and line breaks", () => {
    expect(escapeText("a\\b,c;d\ne\r\nf\rg")).toBe(
      "a\\\\b\\,c\\;d\\ne\\nf\\ng",
    );
  });

  it("drops other control characters", () => {
    expect(escapeText("a\u0000b\u0007c\u007fd\te")).toBe("abcde");
  });
});

describe("foldLine", () => {
  it("folds lines at 75 octets without splitting multi-byte characters", () => {
    const folded = foldLine(`SUMMARY:${"é".repeat(60)}`);
    for (const line of folded.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
    expect(folded.replaceAll("\r\n ", "")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });
});

describe("buildCalendar", () => {
  it("wraps events in a calendar with CRLF line endings", () => {
    const result = calendar();
    expect(result.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(result.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(result).toContain("X-WR-CALNAME:Changes\r\n");
    expect(result).toContain("UID:task-1@kaneo\r\n");
    expect(result).toContain("DTSTAMP:20260922T103000Z");
  });

  it("exports an inclusive all-day range", () => {
    expect(
      calendar([{ ...task, startDate: new Date("2026-09-21T00:00:00Z") }]),
    ).toContain("DTSTART;VALUE=DATE:20260921\r\nDTEND;VALUE=DATE:20260924");
    expect(calendar()).toContain(
      "DTSTART;VALUE=DATE:20260923\r\nDTEND;VALUE=DATE:20260924",
    );
  });

  it("skips unscheduled tasks and repairs reversed ranges", () => {
    expect(calendar([{ ...task, dueDate: null }])).not.toContain(
      "BEGIN:VEVENT",
    );
    expect(
      calendar([{ ...task, startDate: new Date("2026-09-30T00:00:00Z") }]),
    ).toContain("DTEND;VALUE=DATE:20261001");
  });

  it("uses the feed time zone for all-day dates", () => {
    const result = calendar(
      [{ ...task, dueDate: new Date("2026-09-23T23:30:00Z") }],
      "Asia/Ho_Chi_Minh",
    );
    expect(result).toContain("DTSTART;VALUE=DATE:20260924");
  });

  it("falls back to UTC for an unknown time zone", () => {
    expect(calendar([task], "Not/AZone")).toContain(
      "DTSTART;VALUE=DATE:20260923",
    );
  });

  it("cannot be broken out of by injected properties in titles", () => {
    const result = calendar(
      [
        {
          ...task,
          title: "Hi\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:evil, x; y",
        },
      ],
      "UTC",
      "Team;\nX-INJECT:1",
    );
    expect(result).toContain(
      "SUMMARY:Hi\\nEND:VEVENT\\nBEGIN:VEVENT\\nSUMMARY:evil\\, x\\; y",
    );
    expect(result).toContain("X-WR-CALNAME:Team\\;\\nX-INJECT:1");
    expect(result.match(/^BEGIN:VEVENT$/gm)).toHaveLength(1);
    expect(result).not.toMatch(/^X-INJECT/m);
  });

  it("adds a link without line breaks and no description", () => {
    const result = calendar([
      { ...task, url: "https://kaneo.test/task/1\r\nX-BAD:1" },
    ]);
    expect(result).toContain("URL:https://kaneo.test/task/1X-BAD:1\r\n");
    expect(result).not.toContain("DESCRIPTION");
  });
});

describe("calendar feed tokens", () => {
  it("generates 256-bit hex tokens and hashes them with SHA-256", () => {
    const token = generateCalendarFeedToken();
    expect(token).toMatch(CALENDAR_FEED_TOKEN_PATTERN);
    expect(generateCalendarFeedToken()).not.toBe(token);
    expect(hashCalendarFeedToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashCalendarFeedToken(token)).not.toBe(token);
    expect(hashCalendarFeedToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
