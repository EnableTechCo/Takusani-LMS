import { describe, expect, it } from "vitest";
import { monthGrid, monthStart, monthTitle, parseMonth, sastDateOf, sastMonthOf, shiftMonth } from "./month";

describe("the month grid", () => {
  it("reads months and moves between them", () => {
    expect(parseMonth("2026-10")).toBe("2026-10");
    expect(parseMonth("2026-13")).toBeNull();
    expect(parseMonth("../x")).toBeNull();
    expect(parseMonth(undefined)).toBeNull();
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthTitle("2026-10")).toBe("October 2026");
    expect(monthStart("2026-10").toISOString()).toBe("2026-09-30T22:00:00.000Z");
  });

  it("uses South African days and months", () => {
    expect(sastDateOf("2026-09-30T23:30:00Z")).toBe("2026-10-01");
    expect(sastMonthOf(new Date("2026-09-30T22:30:00Z"))).toBe("2026-10");
  });

  it("covers whole weeks from Monday, marking days outside the month and today", () => {
    // October 2026 starts on a Thursday and ends on a Saturday.
    const grid = monthGrid("2026-10", [], "2026-10-05");
    expect(grid).toHaveLength(35);
    expect(grid[0]).toMatchObject({ date: "2026-09-28", day: 28, inMonth: false });
    expect(grid[3]).toMatchObject({ date: "2026-10-01", day: 1, inMonth: true });
    expect(grid[34]).toMatchObject({ date: "2026-11-01", inMonth: false });
    expect(grid.filter((day) => day.today).map((day) => day.date)).toEqual(["2026-10-05"]);
  });

  it("puts each item on its South African day, earliest first", () => {
    const grid = monthGrid(
      "2026-10",
      [
        { at: "2026-10-05T15:00:00+02:00", title: "Late" },
        { at: "2026-10-04T22:30:00Z", title: "Early" },
      ],
      "2026-10-01",
    );
    expect(grid.find((day) => day.date === "2026-10-05")?.items.map((item) => item.title)).toEqual(["Early", "Late"]);
  });
});
