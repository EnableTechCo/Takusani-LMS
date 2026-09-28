import { describe, expect, it } from "vitest";
import { advisoryTotal, historySentence, isRefusal, itemsText, resultsText } from "./roles-rules";

describe("the account's change history (FR-107)", () => {
  it("says what was assigned, with the previous value and any advisory", () => {
    expect(
      historySentence({
        action: "identity.role_assigned",
        before: null,
        after: { role: "moderator", scope_label: "2026 Intake B", until: null },
        details: { advisory_results: 92 },
      }),
    ).toBe(
      "assigned Moderator, 2026 Intake B. Previous value: none. Advisory shown: kept away from 92 results they assessed.",
    );
  });

  it("says what was ended and what it was before", () => {
    expect(
      historySentence({
        action: "identity.role_ended",
        before: { role: "assessor", scope_label: "2026 Intake B", until: null },
        after: { role: "assessor", scope_label: "2026 Intake B", until: "2026-09-28T12:00:00Z" },
        details: null,
      }),
    ).toBe("ended Assessor, 2026 Intake B. Previous value: no end date.");
  });

  it("records a refusal as a refusal, and never hides an unknown action", () => {
    const refused = {
      action: "identity.role_end_refused",
      before: { role: "assessor", scope_label: "2026 Intake B" },
      after: null,
      details: null,
    };
    expect(historySentence(refused)).toBe(
      "tried to end Assessor, 2026 Intake B. Refused: open work depends on it. Nothing was changed.",
    );
    expect(isRefusal(refused.action)).toBe(true);
    expect(historySentence({ action: "identity.something_new", before: null, after: null, details: null })).toBe(
      "identity.something_new",
    );
  });
});

describe("advisory and allocation words (U-01, FR-105)", () => {
  it("count results and items in plain words", () => {
    expect(resultsText(1)).toBe("1 result");
    expect(resultsText(258)).toBe("258 results");
    expect(itemsText(13)).toBe("13 items");
    expect(
      advisoryTotal([
        { type: "x", item_title: "Task 3", cohort_name: "B", results: 92, first_decided_at: "", last_decided_at: "" },
        { type: "x", item_title: "Exam", cohort_name: "B", results: 47, first_decided_at: "", last_decided_at: "" },
      ]),
    ).toBe(139);
  });
});

describe("account administration in the history (S3-08, FR-107)", () => {
  const entry = (
    action: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    details: Record<string, unknown> | null = null,
  ) => historySentence({ action, before, after, details });

  it("names each changed detail with its previous value", () => {
    expect(
      entry(
        "identity.account_updated",
        { full_name: "Lerato Mokoena", learner_number: "KSI-2026-0417" },
        { full_name: "Lerato Mokoena-Dube", learner_number: "KSI-2026-0417" },
      ),
    ).toBe("changed the name from Lerato Mokoena to Lerato Mokoena-Dube.");
  });

  it("records deactivation with its reason, a refusal as a refusal, and a reset", () => {
    expect(
      entry("identity.account_deactivated", { status: "active" }, { status: "deactivated" }, { reason: "Left." }),
    ).toBe("deactivated the account. Reason given: Left. Previous value: active.");
    expect(isRefusal("identity.deactivation_refused")).toBe(true);
    expect(entry("identity.password_reset_sent", null, null)).toBe("sent a password reset link.");
  });
});
