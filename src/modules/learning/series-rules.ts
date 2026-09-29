import { formatLongDayOf, formatTime } from "@/lib/dates";

/** Session series (F-06; FR-206, FR-207): a session that repeats every week or every two weeks, in words. */

export const REPEATS = [
  { value: "none", label: "Does not repeat" },
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every two weeks" },
] as const;

export type Repeat = (typeof REPEATS)[number]["value"];
export type SeriesRepeat = Exclude<Repeat, "none">;

/** A series has at least two sessions and at most twenty-six (half a year of weekly classes). */
export const SERIES_COUNT = { min: 2, max: 26 } as const;

export function parseRepeat(value: string | undefined): Repeat {
  return REPEATS.some((option) => option.value === value) ? (value as Repeat) : "none";
}

/** A whole number of sessions within the allowed range, or null. */
export function parseSeriesCount(value: string | undefined): number | null {
  const count = Number(value);
  return Number.isInteger(count) && count >= SERIES_COUNT.min && count <= SERIES_COUNT.max ? count : null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** When the last session of a series starts. South African time has no daylight saving, so days are whole. */
export function seriesLastStart(startsAtIso: string, repeat: SeriesRepeat, count: number): string {
  const step = (repeat === "weekly" ? 7 : 14) * DAY_MS;
  return new Date(new Date(startsAtIso).getTime() + (count - 1) * step).toISOString();
}

/** "6 sessions, one every week from Tuesday 6 October 2026 to Tuesday 10 November 2026, each at 09:00 (SAST)." */
export function seriesSentence(startsAtIso: string, repeat: SeriesRepeat, count: number): string {
  const last = seriesLastStart(startsAtIso, repeat, count);
  const rhythm = repeat === "weekly" ? "every week" : "every two weeks";
  return `${count} sessions, one ${rhythm} from ${formatLongDayOf(startsAtIso)} to ${formatLongDayOf(last)}, each at ${formatTime(startsAtIso)} (SAST).`;
}

/** "Session 3 of 6". */
export function seriesLabel(seq: number, count: number): string {
  return `Session ${seq} of ${count}`;
}

export const SERIES_REFUSALS: Record<string, string> = {
  invalid_repeat: "Choose whether the session repeats every week or every two weeks.",
  invalid_count: `Choose how many sessions, from ${SERIES_COUNT.min} to ${SERIES_COUNT.max}.`,
};
