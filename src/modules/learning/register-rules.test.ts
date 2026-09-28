import { describe, expect, it } from "vitest";
import { amendmentText, marksFromForm, registerSummary } from "./register-rules";

describe("the register", () => {
  it("sums the marks, and says how many are still to be marked", () => {
    expect(registerSummary([{ status: "present" }, { status: "present" }, { status: "absent" }])).toBe(
      "2 present, 1 absent",
    );
    expect(registerSummary([{ status: "present" }, { status: null }, { status: null }])).toBe(
      "1 present, 0 absent, 2 not marked",
    );
  });

  it("describes an amendment by the mark it replaced", () => {
    expect(amendmentText({ previous_status: "absent", status: "present" })).toBe("Absent to Present");
    expect(amendmentText({ previous_status: null, status: "absent" })).toBe("Added as Absent");
  });

  it("reads the marks from the form, and nothing else", () => {
    expect(
      marksFromForm([
        ["mark:a1", "present"],
        ["mark:b2", "absent"],
        ["mark:c3", "late"],
        ["reason", "Arrived late"],
        ["expectedVersion", "1"],
      ]),
    ).toEqual([
      { learner_id: "a1", status: "present" },
      { learner_id: "b2", status: "absent" },
    ]);
  });
});
