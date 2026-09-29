import { describe, expect, it } from "vitest";
import {
  parseRepeat,
  parseSeriesCount,
  seriesLabel,
  seriesLastStart,
  seriesSentence,
  SERIES_COUNT,
} from "./series-rules";

describe("series rules", () => {
  it("reads the repeat choice, falling back to no repeat", () => {
    expect(parseRepeat("weekly")).toBe("weekly");
    expect(parseRepeat("fortnightly")).toBe("fortnightly");
    expect(parseRepeat("daily")).toBe("none");
    expect(parseRepeat(undefined)).toBe("none");
  });

  it("accepts a whole number of sessions within the range only", () => {
    expect(parseSeriesCount("6")).toBe(6);
    expect(parseSeriesCount(String(SERIES_COUNT.max))).toBe(26);
    expect(parseSeriesCount("1")).toBeNull();
    expect(parseSeriesCount("27")).toBeNull();
    expect(parseSeriesCount("2.5")).toBeNull();
    expect(parseSeriesCount("")).toBeNull();
  });

  it("finds the last session a week or two weeks apart, at the same time of day", () => {
    expect(seriesLastStart("2026-10-06T09:00:00+02:00", "weekly", 6)).toBe("2026-11-10T07:00:00.000Z");
    expect(seriesLastStart("2026-10-06T09:00:00+02:00", "fortnightly", 3)).toBe("2026-11-03T07:00:00.000Z");
  });

  it("says the series in a sentence", () => {
    expect(seriesSentence("2026-10-06T09:00:00+02:00", "weekly", 6)).toBe(
      "6 sessions, one every week from Tuesday 6 October 2026 to Tuesday 10 November 2026, each at 09:00 (SAST).",
    );
    expect(seriesSentence("2026-10-06T14:30:00+02:00", "fortnightly", 2)).toBe(
      "2 sessions, one every two weeks from Tuesday 6 October 2026 to Tuesday 20 October 2026, each at 14:30 (SAST).",
    );
    expect(seriesLabel(3, 6)).toBe("Session 3 of 6");
  });
});
