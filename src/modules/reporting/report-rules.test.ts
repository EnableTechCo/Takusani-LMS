import { describe, expect, it } from "vitest";
import { cellText, exportSize, parseScope, reportColumns, scopeQuery, scopeText } from "./report-rules";

const programme = "10000000-0000-4000-8000-000000000001";
const cohort = "10000000-0000-4000-8000-000000000010";

describe("programme reports", () => {
  it("reads the catalogue's columns", () => {
    expect(reportColumns([["cohort", "Cohort", false], ["learners", "Learners", true], ["bad"]])).toEqual([
      { key: "cohort", label: "Cohort", numeric: false },
      { key: "learners", label: "Learners", numeric: true },
    ]);
    expect(reportColumns(null)).toEqual([]);
  });

  it("takes the scope from the query string and drops anything malformed", () => {
    expect(parseScope({ programme, cohort, from: "2026-09-01", to: "2026-09-30" })).toEqual({
      programmeId: programme,
      cohortId: cohort,
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(parseScope({ programme: "x", cohort: "", from: "1 Sep", to: ["2026-09-30"] })).toEqual({
      programmeId: null,
      cohortId: null,
      from: null,
      to: null,
    });
    expect(scopeQuery({ programmeId: programme, cohortId: null, from: "2026-09-01", to: null })).toBe(
      `?programme=${programme}&from=2026-09-01`,
    );
    expect(scopeQuery({ programmeId: null, cohortId: null, from: null, to: null })).toBe("");
  });

  it("says what a report covers", () => {
    expect(scopeText({ cohortName: "2026 Intake B", from: "2026-09-01", to: "2026-09-30" })).toBe(
      "2026 Intake B, 01 Sept 2026 to 30 Sept 2026",
    );
    expect(scopeText({ cohortName: null, from: null, to: null })).toBe("All your cohorts, all dates");
    expect(scopeText({ cohortName: null, from: "2026-09-01", to: null })).toBe("All your cohorts, from 01 Sept 2026");
  });

  it("writes cells and sizes plainly", () => {
    expect(cellText(null)).toBe("–");
    expect(cellText(1234)).toBe(new Intl.NumberFormat("en-ZA").format(1234));
    expect(cellText("Room 4")).toBe("Room 4");
    expect(exportSize(1, 300)).toBe("1 row, 300 B");
    expect(exportSize(12, 1536)).toBe("12 rows, 1.5 KB");
    expect(exportSize(null, null)).toBe("");
  });
});
