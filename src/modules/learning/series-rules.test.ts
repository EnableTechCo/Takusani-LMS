import { describe, expect, it } from "vitest";
import {
  isSeriesRepeat,
  parseRepeat,
  parseSeriesCount,
  seriesLabel,
  seriesLastStart,
  seriesSentence,
  seriesStart,
  SERIES_COUNT,
} from "./series-rules";

describe("series rules", () => {
  it("reads the repeat choice, falling back to no repeat", () => {
    expect(parseRepeat("daily")).toBe("daily");
    expect(parseRepeat("weekly")).toBe("weekly");
    expect(parseRepeat("fortnightly")).toBe("fortnightly");
    expect(parseRepeat("monthly")).toBe("monthly");
    expect(parseRepeat("yearly")).toBe("none");
    expect(parseRepeat(undefined)).toBe("none");
    expect(isSeriesRepeat("monthly")).toBe(true);
    expect(isSeriesRepeat("none")).toBe(false);
    expect(isSeriesRepeat(null)).toBe(false);
  });

  it("accepts a whole number of sessions within the range only", () => {
    expect(parseSeriesCount("6")).toBe(6);
    expect(parseSeriesCount(String(SERIES_COUNT.max))).toBe(26);
    expect(parseSeriesCount("1")).toBeNull();
    expect(parseSeriesCount("27")).toBeNull();
    expect(parseSeriesCount("2.5")).toBeNull();
    expect(parseSeriesCount("")).toBeNull();
  });

  it("spaces sessions a day, a week or two weeks apart at the same time of day", () => {
    expect(seriesStart("2026-10-06T09:00:00+02:00", "daily", 3)).toBe("2026-10-08T07:00:00.000Z");
    expect(seriesLastStart("2026-10-06T09:00:00+02:00", "weekly", 6)).toBe("2026-11-10T07:00:00.000Z");
    expect(seriesLastStart("2026-10-06T09:00:00+02:00", "fortnightly", 3)).toBe("2026-11-03T07:00:00.000Z");
  });

  it("keeps the day of the month for a monthly series, falling back to a shorter month's last day", () => {
    expect(seriesStart("2027-01-31T09:00:00+02:00", "monthly", 2)).toBe("2027-02-28T07:00:00.000Z");
    expect(seriesStart("2027-01-31T09:00:00+02:00", "monthly", 3)).toBe("2027-03-31T07:00:00.000Z");
    // 01:00 SAST on the 1st is still the day before in UTC; the day of the month is the South African one.
    expect(seriesStart("2027-03-01T01:00:00+02:00", "monthly", 2)).toBe("2027-03-31T23:00:00.000Z");
    expect(seriesStart("2026-11-15T14:30:00+02:00", "monthly", 4)).toBe("2027-02-15T12:30:00.000Z");
  });

  it("says the series in a sentence", () => {
    expect(seriesSentence("2026-10-06T09:00:00+02:00", "weekly", 6)).toBe(
      "6 sessions, one every week from Tuesday 6 October 2026 to Tuesday 10 November 2026, each at 09:00 (SAST).",
    );
    expect(seriesSentence("2026-10-06T14:30:00+02:00", "fortnightly", 2)).toBe(
      "2 sessions, one every two weeks from Tuesday 6 October 2026 to Tuesday 20 October 2026, each at 14:30 (SAST).",
    );
    expect(seriesSentence("2026-10-06T08:00:00+02:00", "daily", 3)).toBe(
      "3 sessions, one every day from Tuesday 6 October 2026 to Thursday 8 October 2026, each at 08:00 (SAST).",
    );
    expect(seriesSentence("2027-01-31T09:00:00+02:00", "monthly", 3)).toBe(
      "3 sessions, one every month from Sunday 31 January 2027 to Wednesday 31 March 2027, each at 09:00 (SAST).",
    );
    expect(seriesLabel(3, 6)).toBe("Session 3 of 6");
  });
});
