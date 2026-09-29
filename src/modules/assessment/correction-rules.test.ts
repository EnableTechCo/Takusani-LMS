import { describe, expect, it } from "vitest";
import {
  approveConsequence,
  BLOCKER_TEXT,
  CANNOT_CONCLUDE_TEXT,
  CORRECTION_REFUSALS,
  CORRECTION_STATE_LABELS,
  correctionTone,
} from "./correction-rules";

describe("corrections under dual control (P-12)", () => {
  it("names each state with its tone", () => {
    expect(CORRECTION_STATE_LABELS.proposed).toBe("Waiting for approval");
    expect(correctionTone("proposed")).toBe("caution");
    expect(correctionTone("approved")).toBe("positive");
    expect(correctionTone("declined")).toBe("neutral");
  });

  it("says why a result cannot be corrected, and why someone cannot approve", () => {
    expect(BLOCKER_TEXT.appeal_final).toBe("Decided on appeal: the decision is final (FR-613).");
    expect(CANNOT_CONCLUDE_TEXT.own_proposal).toMatch(/a second person must approve it/);
    expect(CORRECTION_REFUSALS.same_person).toBe(CANNOT_CONCLUDE_TEXT.own_proposal);
    expect(CORRECTION_REFUSALS.took_a_decision).toMatch(/^You took a decision on this result/);
  });

  it("states the consequence of approving in one sentence", () => {
    expect(approveConsequence("Lerato Mokoena", "Competent", 7)).toBe(
      "This releases Competent to Lerato Mokoena now, replacing the released outcome, which stays on record. Lerato Mokoena is told the result was corrected, and has 7 days from today to appeal it. This cannot be undone.",
    );
  });
});
