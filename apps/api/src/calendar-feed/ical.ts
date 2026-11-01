export type CalendarTask = {
  id: string;
  title: string;
  startDate: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  url?: string;
};

// RFC 5545 TEXT values: backslash, semicolon, comma and line breaks must be
// escaped. Other control characters are not allowed at all, so they are
// dropped; this keeps user text from starting new properties or components.
function isControlCharacter(character: string) {
  const code = character.charCodeAt(0);
  return code < 0x20 || code === 0x7f;
}

function stripControlCharacters(value: string) {
  return Array.from(value)
    .filter((character) => !isControlCharacter(character))
    .join("");
}

export function escapeText(value: string) {
  return stripControlCharacters(
    value
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,"),
  );
}

// URI values are not TEXT-escaped, but must never contain line breaks.
function sanitizeUri(value: string) {
  return stripControlCharacters(value).replace(/\s/g, "");
}

// RFC 5545 limits physical lines to 75 octets, including continuation spaces.
export function foldLine(line: string) {
  const lines: string[] = [];
  let current = "";
  let bytes = 0;
  for (const character of line) {
    const size = Buffer.byteLength(character, "utf8");
    if (bytes + size > 75) {
      lines.push(current);
      current = " ";
      bytes = 1;
    }
    current += character;
    bytes += size;
  }
  lines.push(current);
  return lines.join("\r\n");
}

function timestamp(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function calendarDate(date: Date, formatter: Intl.DateTimeFormat) {
  const parts = formatter.formatToParts(date);
  return ["year", "month", "day"]
    .map((type) => parts.find((part) => part.type === type)?.value)
    .join("");
}

function nextDay(date: string) {
  const day = new Date(
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`,
  );
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString().slice(0, 10).replace(/-/g, "");
}

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function buildCalendar({
  name,
  timeZone,
  tasks,
}: {
  name: string;
  timeZone: string;
  tasks: CalendarTask[];
}) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: isValidTimeZone(timeZone) ? timeZone : "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const events = tasks.flatMap((task) => {
    const scheduledDate = task.startDate ?? task.dueDate;
    if (!scheduledDate) return [];
    const start = calendarDate(scheduledDate, formatter);
    const due = calendarDate(task.dueDate ?? scheduledDate, formatter);
    return [
      "BEGIN:VEVENT",
      `UID:${sanitizeUri(task.id)}@kaneo`,
      `DTSTAMP:${timestamp(task.updatedAt)}`,
      `CREATED:${timestamp(task.createdAt)}`,
      `LAST-MODIFIED:${timestamp(task.updatedAt)}`,
      `DTSTART;VALUE=DATE:${start}`,
      // Task due dates are inclusive; iCalendar's DTEND is exclusive.
      `DTEND;VALUE=DATE:${nextDay(due < start ? start : due)}`,
      `SUMMARY:${escapeText(task.title)}`,
      ...(task.url ? [`URL:${sanitizeUri(task.url)}`] : []),
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    ];
  });

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kaneo//Calendar Feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(name)}`,
    ...events,
    "END:VCALENDAR",
  ];
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}
