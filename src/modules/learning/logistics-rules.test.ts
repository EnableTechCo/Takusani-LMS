import { describe, expect, it } from "vitest";
import { arrangedText, defaultHeadcountText, varianceText } from "./logistics-rules";

describe("defaultHeadcountText (FR-706)", () => {
  it("says the default came from enrolment before any register", () => {
    expect(defaultHeadcountText(24, "enrolment", 0)).toBe("24: the learners enrolled");
  });

  it("says it came from attendance so far once registers exist", () => {
    expect(defaultHeadcountText(19, "expected_attendance", 3)).toBe(
      "19: the average present at the cohort's last 3 sessions with a register",
    );
    expect(defaultHeadcountText(21, "expected_attendance", 1)).toBe(
      "21: the average present at the cohort's last session with a register",
    );
  });
});

describe("arrangedText", () => {
  it("counts what is arranged of what is needed", () => {
    expect(arrangedText(1, 3)).toEqual({ text: "1 of 3 arranged", all: false });
    expect(arrangedText(3, 3)).toEqual({ text: "3 of 3 arranged", all: true });
  });
});

describe("varianceText (FR-707)", () => {
  it("says how many more or fewer came than were confirmed", () => {
    expect(varianceText(18, 24)).toBe("18 present against 24 confirmed: 6 people fewer");
    expect(varianceText(25, 24)).toBe("25 present against 24 confirmed: 1 person more");
    expect(varianceText(24, 24)).toBe("24 present, as confirmed");
  });
});
