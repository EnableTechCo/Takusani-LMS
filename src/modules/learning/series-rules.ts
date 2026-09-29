import { formatLongDayOf, formatTime } from "@/lib/dates";

/**
 * Session series (F-06; FR-206, FR-207): a session that repeats every day, week, two weeks or month, in words.
 * The database spaces the sessions (learning.series_start); these say the same thing before it is saved.
 */

export const REPEATS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every two weeks" },
  { value: "monthly", label: "Every month" },
] as const;

export type Repeat = (typeof REPEATS)[number]["value"];
export type SeriesRepeat = Exclude<Repeat, "none">;

const RHYTHM: Record<SeriesRepeat, string> = {
  daily: "every day",
  weekly: "every week",
  fortnightly: "every two weeks",
  monthly: "every month",
};

/** A series has at least two sessions and at most twenty-six (half a year of weekly classes). */
export const SERIES_COUNT = { min: 2, max: 26 } as const;

export function parseRepeat(value: string | undefined): Repeat {
  return REPEATS.some((option) => option.value === value) ? (value as Repeat) : "none";
}

export function isSeriesRepeat(value: string | null | undefined): value is SeriesRepeat {
  return value !== null && value !== undefined && value !== "none" && parseRepeat(value) === value;
}

/** A whole number of sessions within the allowed range, or null. */
export function parseSeriesCount(value: string | undefined): number | null {
  const count = Number(value);
  return Number.isInteger(count) && count >= SERIES_COUNT.min && count <= SERIES_COUNT.max ? count : null;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** South African time is UTC+02:00 all year, so a date can be moved as if it were UTC and shifted back. */
const SAST_MS = 2 * HOUR_MS;

/**
 * When the `seq`-th session of a series starts, counted in South African time from the first. A monthly series
 * keeps its day of the month, falling back to the last day of a shorter month (from the first date, not the last).
 */
export function seriesStart(startsAtIso: string, repeat: SeriesRepeat, seq: number): string {
  const first = new Date(startsAtIso).getTime();
  if (repeat !== "monthly") {
    const step = { daily: 1, weekly: 7, fortnightly: 14 }[repeat] * DAY_MS;
    return new Date(first + (seq - 1) * step).toISOString();
  }
  const local = new Date(first + SAST_MS);
  const day = local.getUTCDate();
  const target = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + (seq - 1), 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  target.setUTCHours(local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds());
  return new Date(target.getTime() - SAST_MS).toISOString();
}

/** When the last session of a series starts. */
export function seriesLastStart(startsAtIso: string, repeat: SeriesRepeat, count: number): string {
  return seriesStart(startsAtIso, repeat, count);
}

/** "6 sessions, one every week from Tuesday 6 October 2026 to Tuesday 10 November 2026, each at 09:00 (SAST)." */
export function seriesSentence(startsAtIso: string, repeat: SeriesRepeat, count: number): string {
  const last = seriesLastStart(startsAtIso, repeat, count);
  return `${count} sessions, one ${RHYTHM[repeat]} from ${formatLongDayOf(startsAtIso)} to ${formatLongDayOf(last)}, each at ${formatTime(startsAtIso)} (SAST).`;
}

/** "Session 3 of 6". */
export function seriesLabel(seq: number, count: number): string {
  return `Session ${seq} of ${count}`;
}

/** "every week", for a stored rhythm. */
export function rhythmText(repeat: SeriesRepeat): string {
  return RHYTHM[repeat];
}

export const SERIES_REFUSALS: Record<string, string> = {
  invalid_repeat: "Choose how often the session repeats: every day, week, two weeks or month.",
  invalid_count: `Choose how many sessions, from ${SERIES_COUNT.min} to ${SERIES_COUNT.max}.`,
};
