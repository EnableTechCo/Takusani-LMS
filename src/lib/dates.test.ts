import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  formatDay,
  formatDayOf,
  formatDateTimeSeconds,
  instantFromSast,
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
});
