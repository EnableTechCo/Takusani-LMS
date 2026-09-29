import { describe, expect, it } from "vitest";
import { amendmentText, checkinSummary, initialMarks, marksFromForm, registerSummary } from "./register-rules";

describe("the register", () => {
  it("sums the marks, and says how many are still to be marked", () => {
    expect(registerSummary([{ status: "present" }, { status: "present" }, { status: "absent" }])).toBe(
      "2 present, 1 absent",
    );
    expect(registerSummary([{ status: "present" }, { status: null }, { status: null }])).toBe(
      "1 present, 0 absent, 2 not marked",
    );
  });

  it("opens with the check-ins filled in, until it is confirmed", () => {
    const roster = [
      { learner_id: "a1", full_name: "A", learner_number: null, enrolled: true, status: null, checked_in_at: "x" },
      { learner_id: "b2", full_name: "B", learner_number: null, enrolled: true, status: null, checked_in_at: null },
      {
        learner_id: "c3",
        full_name: "C",
        learner_number: null,
        enrolled: true,
        status: "absent" as const,
        checked_in_at: "x",
      },
    ];
    expect(checkinSummary(roster)).toBe("2 of 3 checked in");
    expect([...initialMarks(roster, false)]).toEqual([
      ["a1", "present"],
      ["b2", "absent"],
      ["c3", "absent"],
    ]);
    expect([...initialMarks(roster, true)]).toEqual([
      ["a1", null],
      ["b2", null],
      ["c3", "absent"],
    ]);
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
