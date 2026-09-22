import { describe, expect, it } from "vitest";
import { formatDateTime, formatDay, formatDayOf } from "./dates";

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
});
