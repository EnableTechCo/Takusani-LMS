import { describe, expect, it } from "vitest";
import { missingForFinalise, runningTotal, type Draft } from "./rules";

const empty: Draft = {
  scores: [],
  feedback: "",
  outcome: null,
  justification: "",
  remediation: "",
  resubmissionDays: null,
};

describe("missingForFinalise", () => {
  it("names the outcome and the justification when nothing is decided", () => {
    expect(missingForFinalise(empty)).toEqual(["the outcome", "the justification"]);
  });

  it("asks nothing more of a justified Competent decision", () => {
    expect(missingForFinalise({ ...empty, outcome: "competent", justification: "Meets every criterion." })).toEqual([]);
  });

  it("requires remediation and a resubmission period for Not yet competent (FR-405)", () => {
    const nyc = { ...empty, outcome: "not_yet_competent" as const, justification: "Criterion 2 is not met." };
    expect(missingForFinalise(nyc)).toEqual(["what the learner must do", "the resubmission period"]);
    expect(missingForFinalise({ ...nyc, remediation: "Add the schedule.", resubmissionDays: 14 })).toEqual([]);
  });

  it("does not accept a justification of spaces", () => {
    expect(missingForFinalise({ ...empty, outcome: "competent", justification: "   " })).toEqual(["the justification"]);
  });
});

describe("runningTotal", () => {
  it("adds the marks given against what the rubric is worth", () => {
    const criteria = [
      { ordinal: 1, points: 10 },
      { ordinal: 2, points: 5 },
      { ordinal: 3, points: 5 },
    ];
    const scores = [
      { ordinal: 1, points: 9, comment: "" },
      { ordinal: 2, points: 2, comment: "" },
      { ordinal: 3, points: null, comment: "" },
    ];
    expect(runningTotal(criteria, scores)).toEqual({ scored: 11, possible: 20 });
  });

  it("has no total when the rubric carries no points", () => {
    expect(runningTotal([{ ordinal: 1, points: null }], [])).toBeNull();
  });
});
