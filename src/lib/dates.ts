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

const DATE_TIME_SECONDS = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
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

/** An instant to the second, for logs, for example "02 Sept 2026, 09:00:02". */
export function formatDateTimeSeconds(iso: string): string {
  return DATE_TIME_SECONDS.format(new Date(iso));
}

/**
 * A `datetime-local` value ("2026-10-02T17:00") as an instant. South African time is UTC+02:00 all year, with no
 * daylight saving, so the offset is fixed.
 */
export function instantFromSast(local: string): string {
  return `${local}:00+02:00`;
}

/** The reverse: an instant as the `datetime-local` value a South African reader expects. */
export function sastInputValue(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZONE,
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

/** Today's date in South Africa plus a number of days, as YYYY-MM-DD, for dates stated before anything is saved. */
export function sastDatePlusDays(days: number, from: Date = new Date()): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(from);
  const date = new Date(`${today}T12:00:00+02:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(date);
}

const LONG_DAY = new Intl.DateTimeFormat("en-ZA", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: ZONE,
});

/**
 * The South African day of an instant as it is said in a sentence, with no comma after the weekday, for example
 * "Tuesday 29 September 2026" (UX architecture, principle 2).
 */
export function formatLongDayOf(iso: string): string {
  const parts = LONG_DAY.formatToParts(new Date(iso));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/**
 * The last full South African day before an exclusive deadline instant: an appeal window that closes at the start
 * of 30 September is shown to people as "until the end of 29 September" (P-11). `long` says it in a sentence's words,
 * "Tuesday 29 September 2026".
 */
export function lastFullDayBefore(deadlineIso: string, style: "short" | "long" = "short"): string {
  const lastSecond = new Date(new Date(deadlineIso).getTime() - 1000).toISOString();
  return style === "long" ? formatLongDayOf(lastSecond) : formatDayOf(lastSecond);
}

/**
 * Whole calendar days from today to an instant, counted in South African dates: 0 is today, 1 is tomorrow, -1 was
 * yesterday. Not elapsed hours divided by 24, which would call something due in three hours "tomorrow".
 */
export function sastDaysFromToday(iso: string, now: Date = new Date()): number {
  const day = (instant: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(instant);
  const [target, today] = [day(new Date(iso)), day(now)];
  return Math.round((Date.parse(`${target}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** The time of day of an instant in South Africa, for example "12:39". */
export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: ZONE,
  }).format(new Date(iso));
}
