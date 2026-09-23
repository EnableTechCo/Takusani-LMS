import { describe, expect, it } from "vitest";
import { appealWindow, missingForFinalise, resubmission, runningTotal, type Draft } from "./rules";

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

describe("appealWindow", () => {
  // Released on Tuesday 22 September 2026: the window closes at the start of Wednesday 30 September (P-11).
  const deadline = "2026-09-30T00:00:00+02:00";

  it("counts whole days after today up to the last full day", () => {
    expect(appealWindow(deadline, new Date("2026-09-22T14:05:00+02:00"))).toEqual({
      state: "open",
      lastDay: "Tuesday 29 September 2026",
      daysLeft: 7,
    });
    expect(appealWindow(deadline, new Date("2026-09-28T23:59:00+02:00"))).toMatchObject({ daysLeft: 1 });
  });

  it("says so on the last day, until the very end of it", () => {
    expect(appealWindow(deadline, new Date("2026-09-29T00:00:00+02:00")).state).toBe("last_day");
    expect(appealWindow(deadline, new Date("2026-09-29T23:59:59+02:00")).state).toBe("last_day");
  });

  it("is closed from the start of the eighth day", () => {
    expect(appealWindow(deadline, new Date("2026-09-30T00:00:00+02:00"))).toEqual({
      state: "closed",
      lastDay: "Tuesday 29 September 2026",
    });
  });
});

describe("resubmission", () => {
  const base = {
    deadlineAt: "2026-10-06T14:05:00+02:00",
    taskClosed: false,
    assessedVersion: 1,
    latestVersion: 1,
    now: new Date("2026-09-23T10:00:00+02:00"),
  };

  it("is open before the deadline on a task that still takes versions", () => {
    expect(resubmission(base)).toBe("open");
  });

  it("does not offer a resubmission the task would refuse", () => {
    expect(resubmission({ ...base, taskClosed: true })).toBe("task_closed");
  });

  it("has ended at the deadline", () => {
    expect(resubmission({ ...base, now: new Date("2026-10-06T14:05:00+02:00") })).toBe("ended");
  });

  it("waits when a later version is already being assessed, whatever the clock says", () => {
    expect(resubmission({ ...base, latestVersion: 2 })).toBe("waiting");
    expect(resubmission({ ...base, latestVersion: 2, now: new Date("2026-10-07T09:00:00+02:00") })).toBe("waiting");
  });
});
