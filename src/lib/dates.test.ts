import { describe, expect, it } from "vitest";
import {
  appealWindowDaysOf,
  formatDateTime,
  formatDateTimeSeconds,
  formatDay,
  formatDayOf,
  formatLongDayOf,
  formatTime,
  instantFromSast,
  lastFullDayBefore,
  sastDatePlusDays,
  sastDaysBetween,
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

describe("appeal windows (S3-09)", () => {
  it("counts calendar days in SAST, not UTC", () => {
    // 23:30 UTC on 30 Sep is 01:30 on 1 Oct in South Africa.
    expect(sastDaysBetween("2026-09-30T23:30:00Z", "2026-10-02T08:00:00+02:00")).toBe(1);
    expect(sastDaysBetween("2026-10-01T10:00:00+02:00", "2026-10-01T23:00:00+02:00")).toBe(0);
  });

  it("reads the window a result was released with from its deadline", () => {
    // Released on 1 October with 7 days: open to the end of 8 October, closing at the start of 9 October.
    expect(appealWindowDaysOf("2026-10-01T10:15:00+02:00", "2026-10-09T00:00:00+02:00")).toBe(7);
    expect(appealWindowDaysOf("2026-10-01T10:15:00+02:00", "2026-10-16T00:00:00+02:00")).toBe(14);
  });
});
