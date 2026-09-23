import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDateTimeSeconds,
  formatDay,
  formatDayOf,
  formatLongDayOf,
  formatTime,
  instantFromSast,
  lastFullDayBefore,
  sastDatePlusDays,
  sastDaysFromToday,
  sastInputValue,
} from "./dates";

describe("dates in SAST", () => {
  it("shows a stored date as the same calendar day", () => {
    expect(formatDay("2026-07-01")).toBe("01 Jul 2026");
  });

  it("shows an instant in South African time", () => {
    // 22:30 UTC is 00:30 the next day in Johannesburg.
    expect(formatDateTime("2026-09-22T22:30:00Z")).toBe("23 Sept 2026, 00:30");
  });

  it("takes the day of an instant in South African time, not UTC", () => {
    expect(formatDayOf("2026-09-22T22:30:00Z")).toBe("23 Sept 2026");
  });

  it("shows log times to the second in South African time", () => {
    expect(formatDateTimeSeconds("2026-09-02T07:00:02Z")).toBe("02 Sept 2026, 09:00:02");
  });

  it("reads a local date and time as South African time, and writes it back", () => {
    expect(instantFromSast("2026-10-02T17:00")).toBe("2026-10-02T17:00:00+02:00");
    expect(sastInputValue("2026-10-02T15:00:00Z")).toBe("2026-10-02T17:00");
  });

  it("adds days to the South African date, not the UTC one", () => {
    // 23:30 SAST on 22 September is still 21:30 UTC, but in South Africa it is already the 22nd.
    expect(sastDatePlusDays(7, new Date("2026-09-22T21:30:00Z"))).toBe("2026-09-29");
    expect(sastDatePlusDays(7, new Date("2026-09-22T22:30:00Z"))).toBe("2026-09-30");
  });

  it("shows an exclusive deadline as the last full day before it (P-11)", () => {
    expect(lastFullDayBefore("2026-09-29T22:00:00Z")).toBe("29 Sept 2026");
    expect(lastFullDayBefore("2026-09-29T22:00:00Z", "long")).toBe("Tuesday 29 September 2026");
  });

  it("says a day in a sentence's words, by the South African date", () => {
    expect(formatLongDayOf("2026-10-06T12:05:00Z")).toBe("Tuesday 6 October 2026");
    // 23:30 SAST on the 6th is still the 6th, although it is 21:30 UTC.
    expect(formatLongDayOf("2026-10-06T21:30:00Z")).toBe("Tuesday 6 October 2026");
  });

  it("counts days by South African calendar date, so three hours away is today, not tomorrow", () => {
    const now = new Date("2026-09-23T10:00:00+02:00");
    expect(sastDaysFromToday("2026-09-23T13:00:00+02:00", now)).toBe(0);
    expect(sastDaysFromToday("2026-09-24T08:00:00+02:00", now)).toBe(1);
    expect(sastDaysFromToday("2026-09-22T23:59:00+02:00", now)).toBe(-1);
    // 23:30 SAST on the 23rd is still the 23rd, although it is 21:30 UTC.
    expect(sastDaysFromToday("2026-09-23T23:30:00+02:00", now)).toBe(0);
  });

  it("gives the time of day in South Africa", () => {
    expect(formatTime("2026-09-23T10:39:00Z")).toBe("12:39");
  });
});
