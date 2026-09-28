import { describe, expect, it } from "vitest";
import { buildCalendar, foldLine, icalInstant, icalText, type FeedEvent } from "./ical";

const session: FeedEvent = {
  kind: "session",
  id: "s1",
  title: "Session 14: Minutes, agendas; and notes",
  starts_at: "2026-10-05T08:00:00+02:00",
  ends_at: "2026-10-05T09:30:00+02:00",
  location: "Online",
  cancelled: false,
  updated_at: "2026-09-28T10:00:00Z",
};
const due: FeedEvent = {
  kind: "due",
  id: "t3",
  title: "Task 3: Workplace records portfolio",
  starts_at: "2026-10-09T17:00:00+02:00",
  ends_at: "2026-10-09T17:00:00+02:00",
  location: null,
  cancelled: false,
  updated_at: "2026-09-20T10:00:00Z",
};

describe("iCalendar values", () => {
  it("writes instants in UTC", () => {
    expect(icalInstant("2026-10-05T08:00:00+02:00")).toBe("20261005T060000Z");
  });

  it("escapes text", () => {
    expect(icalText("A, B; C\\D\nE")).toBe("A\\, B\\; C\\\\D\\nE");
  });

  it("folds long lines at 75 octets without splitting a character", () => {
    const folded = foldLine(`SUMMARY:${"é".repeat(60)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(folded.replace(/\r\n /g, "")).toBe(`SUMMARY:${"é".repeat(60)}`);
  });
});

describe("buildCalendar", () => {
  const document = buildCalendar([session, due, { ...session, id: "s2", cancelled: true }], {
    appUrl: "https://lms.example",
    now: new Date("2026-09-28T12:00:00Z"),
  });

  it("is a calendar of events with CRLF line endings", () => {
    expect(document.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(document.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(document.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(document.replace(/\r\n/g, "")).not.toMatch(/\n/);
  });

  it("gives each event a stable identifier, its times, and a link into the LMS", () => {
    const unfolded = document.replace(/\r\n /g, "");
    expect(unfolded).toContain("UID:session-s1@takusani-lms");
    expect(unfolded).toContain("DTSTART:20261005T060000Z\r\nDTEND:20261005T073000Z");
    expect(unfolded).toContain("SUMMARY:Session 14: Minutes\\, agendas\\; and notes");
    expect(unfolded).toContain("URL:https://lms.example/learn/calendar#session-s1");
    expect(unfolded).toContain("LOCATION:Online");
  });

  it("marks a due date as due, without blocking time, and a cancelled session as cancelled", () => {
    const unfolded = document.replace(/\r\n /g, "");
    expect(unfolded).toContain("SUMMARY:Due: Task 3: Workplace records portfolio");
    expect(unfolded).toContain("URL:https://lms.example/learn/tasks/t3");
    expect(unfolded).toMatch(/UID:due-t3@takusani-lms[\s\S]*?TRANSP:TRANSPARENT/);
    expect(unfolded).toMatch(/UID:session-s2@takusani-lms[\s\S]*?STATUS:CANCELLED/);
  });

  it("names nobody and links to nothing outside the LMS", () => {
    expect(document).not.toMatch(/teams\.microsoft\.com|teams\.live\.com/);
    expect(document).toContain("X-WR-CALNAME:Takusani LMS\r\n");
  });
});
