/**
 * The learner's calendar feed as an iCalendar document (S3-13; FR-304; ADR-020; RFC 5545). Schedule fields only:
 * title, start, end, place and a link into the LMS. The database has already left out everything else (results,
 * notices, Teams join links), and this adds nothing personal: not even the learner's name.
 */

export interface FeedEvent {
  kind: "session" | "due";
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  cancelled: boolean;
  updated_at: string;
}

/** 20261005T080000Z: an instant in UTC, which every calendar app shows in its own time zone. */
export function icalInstant(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Escapes a text value: backslash, semicolon and comma, and new lines as \n. */
export function icalText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

const encoder = new TextEncoder();

/** Folds a content line at 75 octets, continuing with a space, without splitting a multi-byte character. */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    if (encoder.encode(current + character).length > limit) {
      parts.push(current);
      current = character;
      limit = 74; // A continuation line starts with a space.
    } else {
      current += character;
    }
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** The whole document. `appUrl` is the LMS origin, for each event's link. */
export function buildCalendar(events: FeedEvent[], { appUrl, now }: { appUrl: string; now: Date }): string {
  const stamp = icalInstant(now.toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Takusani//LMS calendar feed//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Takusani LMS",
    "X-WR-TIMEZONE:Africa/Johannesburg",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of events) {
    const link =
      event.kind === "session" ? `${appUrl}/learn/calendar#session-${event.id}` : `${appUrl}/learn/tasks/${event.id}`;
    const summary = event.kind === "due" ? `Due: ${event.title}` : event.title;
    const description =
      event.kind === "session"
        ? `Open it in the LMS to join or see the details: ${link}`
        : `Hand it in through the LMS: ${link}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.kind}-${event.id}@takusani-lms`,
      `DTSTAMP:${stamp}`,
      `LAST-MODIFIED:${icalInstant(event.updated_at)}`,
      `DTSTART:${icalInstant(event.starts_at)}`,
      `DTEND:${icalInstant(event.ends_at)}`,
      `SUMMARY:${icalText(summary)}`,
      `DESCRIPTION:${icalText(description)}`,
      `URL:${link}`,
      ...(event.location ? [`LOCATION:${icalText(event.location)}`] : []),
      `STATUS:${event.cancelled ? "CANCELLED" : "CONFIRMED"}`,
      `TRANSP:${event.kind === "due" ? "TRANSPARENT" : "OPAQUE"}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
