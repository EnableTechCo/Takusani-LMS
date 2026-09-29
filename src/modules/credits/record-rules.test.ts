import { describe, expect, it } from "vitest";
import {
  byProgramme,
  historyLine,
  itemNote,
  summarySentence,
  unitStatus,
  type CreditItem,
  type CreditUnitRow,
} from "./record-rules";

const now = new Date("2026-09-29T10:00:00Z");

const item = (over: Partial<CreditItem>): CreditItem => ({
  title: "Task 3",
  state: "competent",
  result_id: "r1",
  deadline_at: null,
  due_at: null,
  ...over,
});

const unit = (over: Partial<CreditUnitRow>): CreditUnitRow => ({
  programme_id: "p1",
  programme_title: "Certificate in Business Administration",
  nqf_level: 4,
  cohort_id: "c1",
  cohort_name: "2026 Intake B",
  cohort_status: "active",
  unit_id: "u3",
  unit_code: "U3",
  unit_title: "Keep workplace records",
  credits: 12,
  earned: 0,
  awarded: false,
  awarded_at: null,
  requirements_set: true,
  items: [],
  ...over,
});

describe("the learner's credits record", () => {
  it("totals a programme from the ledger and splits its units", () => {
    const [programme] = byProgramme([
      unit({ earned: 12, awarded: true, awarded_at: "2026-09-22T10:00:00Z" }),
      unit({ unit_id: "u4", unit_code: "U4", credits: 8 }),
      unit({ unit_id: "u5", unit_code: "U5", credits: null }),
    ]);
    expect(programme.earned).toBe(12);
    expect(programme.total).toBe(20);
    expect(programme.outstanding).toBe(8);
    expect(programme.earnedUnits.map((row) => row.unit_code)).toEqual(["U3"]);
    expect(programme.outstandingUnits.map((row) => row.unit_code)).toEqual(["U4", "U5"]);
  });

  it("says where the learner stands in one sentence", () => {
    expect(summarySentence({ earned: 52, total: 140, outstanding: 88 })).toBe(
      "You have earned 52 of 140 credits. 88 credits are still outstanding.",
    );
    expect(summarySentence({ earned: 0, total: 140, outstanding: 140 })).toBe(
      "You have not earned any credits yet. All 140 credits are still outstanding.",
    );
    expect(summarySentence({ earned: 139, total: 140, outstanding: 1 })).toBe(
      "You have earned 139 of 140 credits. 1 credit is still outstanding.",
    );
    expect(summarySentence({ earned: 140, total: 140, outstanding: 0 })).toBe(
      "You have earned all 140 credits of your programme.",
    );
    expect(summarySentence({ earned: 0, total: 0, outstanding: 0 })).toBe(
      "The credit values for your programme have not been set yet.",
    );
  });

  it("gives each unit its standing", () => {
    expect(unitStatus(unit({ awarded: true, awarded_at: "2026-09-22T10:00:00Z" }), now).label).toBe(
      "Earned on 22 Sept 2026",
    );
    expect(unitStatus(unit({ requirements_set: false }), now).label).toBe("Assessments not set yet");
    expect(
      unitStatus(unit({ items: [item({ state: "not_yet_competent", deadline_at: "2026-10-06T10:00:00Z" })] }), now)
        .label,
    ).toBe("Resubmission open");
    expect(
      unitStatus(unit({ items: [item({}), item({ title: "Task 4", state: "being_assessed", result_id: null })] }), now)
        .label,
    ).toBe("In progress: 1 of 2 assessments Competent");
    expect(unitStatus(unit({ items: [item({ state: "not_started", result_id: null })] }), now).label).toBe(
      "Not started",
    );
  });

  it("gives a held result no credit value and says what the learner can do", () => {
    expect(itemNote(item({ state: "being_assessed", result_id: null }), now)).toBe(
      "No credit value until the result is released.",
    );
    expect(itemNote(item({ state: "not_yet_competent", deadline_at: "2026-10-06T15:00:00Z" }), now)).toBe(
      "You can resubmit until 06 Oct 2026, 17:00.",
    );
    expect(itemNote(item({ state: "not_yet_competent", deadline_at: "2026-09-01T15:00:00Z" }), now)).toBe(
      "The resubmission period has ended. Speak to your coordinator.",
    );
    expect(itemNote(item({ state: "competent" }), now)).toBeNull();
  });

  it("writes each ledger line as an award or a reversal, never a rewritten total", () => {
    const base = { entry_id: 1, created_at: "2026-09-22T10:00:00Z", unit_code: "U3", unit_title: "Records" };
    expect(historyLine({ ...base, credits: 12, entry_type: "award", cause: "release", total: 12 })).toEqual({
      amount: "+12 credits",
      detail: "award · total 12",
    });
    expect(historyLine({ ...base, credits: -8, entry_type: "reversal", cause: "appeal", total: 4 })).toEqual({
      amount: "−8 credits",
      detail: "reversal after an appeal decision · total 4",
    });
    expect(historyLine({ ...base, credits: 1, entry_type: "award", cause: "correction", total: 5 }).amount).toBe(
      "+1 credit",
    );
  });
});
