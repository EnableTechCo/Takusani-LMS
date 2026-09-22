/** Dates and times as South African staff and learners read them (SAST, UX architecture 10.2). */
const ZONE = "Africa/Johannesburg";

const DAY = new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short", year: "numeric", timeZone: ZONE });
const DATE_TIME = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: ZONE,
});

/** A calendar date stored without a time (YYYY-MM-DD), for example "01 Jul 2026". */
export function formatDay(isoDate: string): string {
  return DAY.format(new Date(`${isoDate}T12:00:00+02:00`));
}

/** The South African calendar day of an instant, for example when something happened. */
export function formatDayOf(iso: string): string {
  return DAY.format(new Date(iso));
}

/** An instant, for example "22 Sept 2026, 13:56". */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso));
}
