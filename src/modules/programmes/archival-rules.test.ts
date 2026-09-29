import { describe, expect, it } from "vitest";
import { archiveConsequence, blockerLines, type ArchivalBlockers } from "./archival-rules";

const clear: ArchivalBlockers = {
  open_cycles: 0,
  not_assessed: 0,
  held: 0,
  pending: 0,
  resubmissions: 0,
  appeal_window_until: null,
  open_appeals: 0,
  open_corrections: 0,
};

describe("cohort archival", () => {
  it("names nothing when nothing blocks archiving", () => {
    expect(blockerLines(clear)).toEqual([]);
  });

  it("lists each unmet condition with its count", () => {
    expect(
      blockerLines({
        ...clear,
        open_cycles: 1,
        not_assessed: 2,
        held: 3,
        pending: 1,
        resubmissions: 1,
        open_appeals: 1,
        open_corrections: 2,
      }),
    ).toEqual([
      "1 moderation cycle is not signed off or cancelled.",
      "2 pieces of work have been handed in and not assessed.",
      "3 results are still held.",
      "1 later decision is waiting for moderation.",
      "1 resubmission is waiting to be marked.",
      "1 appeal is not concluded.",
      "2 corrections are waiting for approval.",
    ]);
  });

  it("gives the last full day an appeal can still be lodged", () => {
    // The window closes at the start of 30 Sep 2026 in South Africa, so the 29th is the last full day.
    expect(blockerLines({ ...clear, appeal_window_until: "2026-09-29T22:00:00Z" })).toEqual([
      "Appeal windows are open until the end of Tuesday 29 September 2026.",
    ]);
  });

  it("says archiving is read-only for everyone and keeps the records", () => {
    const text = archiveConsequence("2025 Intake A", 1);
    expect(text).toMatch(/^2025 Intake A becomes read-only for everyone/);
    expect(text).toMatch(/1 learner's results and credits, stay available to reports/);
  });
});
