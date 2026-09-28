import { describe, expect, it } from "vitest";
import { decidedAndReleased, isHeld, stageText, summarise, type ReleaseRow } from "./release-status";

function row(overrides: Partial<ReleaseRow>): ReleaseRow {
  return {
    decision_id: crypto.randomUUID(),
    instance_id: crypto.randomUUID(),
    result_id: crypto.randomUUID(),
    cohort_id: "c-b",
    cohort_name: "2026 Intake B",
    moderation_policy: "moderated",
    item_id: "task-3",
    item_title: "Task 3",
    learner_name: "Lerato Mokoena",
    learner_number: null,
    outcome: "competent",
    decided_at: "2026-09-10T09:20:00Z",
    stage: "waiting_for_cycle",
    released_at: null,
    replaced_by: null,
    replaced_at: null,
    ...overrides,
  };
}

describe("stageText", () => {
  it("says a held decision is waiting for a cycle, or in moderation (UX spec 7.4)", () => {
    expect(stageText(row({ stage: "waiting_for_cycle" }))).toBe("Held: waiting for a moderation cycle");
    expect(stageText(row({ stage: "in_moderation" }))).toBe("Held: in moderation");
  });

  it("dates a release in South African time", () => {
    expect(stageText(row({ stage: "released", released_at: "2026-09-21T22:30:00Z" }))).toBe("Released 22 Sept 2026");
  });

  it("says what replaced a decision, and when", () => {
    expect(stageText(row({ stage: "replaced", replaced_by: "appeal", replaced_at: "2026-10-05T08:00:00Z" }))).toBe(
      "Replaced on appeal 05 Oct 2026",
    );
    expect(stageText(row({ stage: "replaced", replaced_by: "assessment", replaced_at: "2026-10-05T08:00:00Z" }))).toBe(
      "Replaced by a later decision 05 Oct 2026",
    );
    expect(stageText(row({ stage: "replaced", replaced_by: "correction", replaced_at: "2026-10-05T08:00:00Z" }))).toBe(
      "Corrected 05 Oct 2026",
    );
  });
});

describe("decidedAndReleased", () => {
  it("gives both facts with both dates (UX spec 7.3)", () => {
    expect(decidedAndReleased("2026-09-10T09:20:00Z", "2026-09-22T12:05:00Z")).toBe(
      "Decided 10 Sept 2026. Released 22 Sept 2026.",
    );
  });

  it("says plainly when a decision was never released", () => {
    expect(decidedAndReleased("2026-09-10T09:20:00Z", null)).toBe("Decided 10 Sept 2026. Not released.");
  });
});

describe("isHeld", () => {
  it("is true while waiting for a cycle or in one, and not once released or replaced", () => {
    expect(isHeld({ stage: "waiting_for_cycle" })).toBe(true);
    expect(isHeld({ stage: "in_moderation" })).toBe(true);
    expect(isHeld({ stage: "released" })).toBe(false);
    expect(isHeld({ stage: "replaced" })).toBe(false);
  });
});

describe("summarise", () => {
  it("counts each item's decisions by where they stand, and its latest release", () => {
    const [cohort] = summarise([
      row({ stage: "waiting_for_cycle" }),
      row({ stage: "in_moderation" }),
      row({ stage: "released", released_at: "2026-09-22T12:05:00Z" }),
      row({ stage: "replaced", released_at: "2026-09-12T12:05:00Z", replaced_by: "assessment" }),
    ]);
    expect(cohort).toMatchObject({ cohortName: "2026 Intake B", moderated: true, decided: 4, held: 2, released: 1 });
    expect(cohort!.items).toEqual([
      {
        itemId: "task-3",
        itemTitle: "Task 3",
        decided: 4,
        waiting: 1,
        inModeration: 1,
        released: 1,
        lastReleasedAt: "2026-09-22T12:05:00Z",
      },
    ]);
  });

  it("puts cohorts with something held first, then by name, and items by title", () => {
    const cohorts = summarise([
      row({ cohort_id: "c-a", cohort_name: "2026 Intake A", stage: "released", released_at: "2026-09-22T12:05:00Z" }),
      row({ cohort_id: "c-c", cohort_name: "2026 Intake C", item_id: "t2", item_title: "Task 2" }),
      row({ cohort_id: "c-c", cohort_name: "2026 Intake C", item_id: "t1", item_title: "Task 1" }),
    ]);
    expect(cohorts.map((cohort) => cohort.cohortName)).toEqual(["2026 Intake C", "2026 Intake A"]);
    expect(cohorts[0]!.items.map((item) => item.itemTitle)).toEqual(["Task 1", "Task 2"]);
  });

  it("is empty with no decisions", () => {
    expect(summarise([])).toEqual([]);
  });
});
