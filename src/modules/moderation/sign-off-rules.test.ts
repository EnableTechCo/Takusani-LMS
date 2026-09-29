import { describe, expect, it } from "vitest";
import {
  afterFreezeText,
  blockerActorText,
  blockerStateLabel,
  blockingReasons,
  consequenceText,
  eligibilityText,
  isReady,
  progressSteps,
  signedOffText,
  type Blocker,
  type SignOffFacts,
} from "./sign-off-rules";

const blocker = (over: Partial<Blocker>): Blocker => ({
  item_id: "i1",
  seq: 7,
  learner_name: "Naledi Khoza",
  item_title: "Task 3",
  assessor_name: "Nomvula Mahlangu",
  moderator_id: "m1",
  moderator_name: "Thandiwe Nkosi",
  state: "returned",
  returned_at: "2026-09-21T09:05:00Z",
  due_on: "2026-09-25",
  overdue: false,
  ...over,
});

const facts = (over: Partial<SignOffFacts>): SignOffFacts => ({
  state: "frozen",
  cohort_name: "2026 Intake C",
  population: 96,
  competent: 90,
  not_yet_competent: 6,
  sample: 22,
  concluded: 22,
  unallocated: 0,
  observations: 1,
  after_freeze: 0,
  blockers: [],
  may_sign: true,
  assessed_by_me: 0,
  other_signers: [],
  appeal_window_days: 7,
  signed_off_at: null,
  signed_off_by_name: null,
  released_count: null,
  notified_count: null,
  ...over,
});

describe("sign-off readiness (FR-510)", () => {
  it("names what blocks, and is ready when nothing does", () => {
    const blocked = facts({
      concluded: 19,
      unallocated: 1,
      blockers: [
        blocker({}),
        blocker({ item_id: "i2", state: "remarked" }),
        blocker({ item_id: "i3", state: "unallocated" }),
      ],
    });
    expect(blockingReasons(blocked)).toEqual([
      "3 sample items are not concluded.",
      "2 returned items are still open.",
      "1 item needs a moderator.",
    ]);
    expect(isReady(blocked)).toBe(false);
    expect(blockingReasons(facts({}))).toEqual([]);
    expect(isReady(facts({}))).toBe(true);
    expect(isReady(facts({ state: "signed_off" }))).toBe(false);
  });

  it("says who must act on each blocker", () => {
    expect(blockerStateLabel(blocker({}))).toBe("Waiting for assessor");
    expect(blockerActorText(blocker({}), "m1")).toBe("Nomvula Mahlangu, assessor: must re-mark");
    expect(blockerActorText(blocker({ state: "remarked" }), "m1")).toBe("You: review the re-mark");
    expect(blockerActorText(blocker({ state: "allocated" }), "other")).toBe(
      "Thandiwe Nkosi, moderator: record a finding",
    );
    expect(blockerActorText(blocker({ state: "unallocated", moderator_id: null }), "m1")).toBe(
      "The coordinator: must allocate a moderator",
    );
    expect(blockerStateLabel(blocker({ state: "remarked" }))).toBe("Re-marked. Review again");
  });
});

describe("sign-off wording (FR-511, P-05, P-06)", () => {
  it("states eligibility over the whole population", () => {
    expect(eligibilityText(facts({}))).toBe(
      "You can sign off this cycle: you took no assessment decision on any of its 96 results.",
    );
    expect(eligibilityText(facts({ may_sign: false, assessed_by_me: 2, other_signers: ["Anil Naidoo"] }))).toBe(
      "You cannot sign off this cycle because you assessed 2 of its 96 results. Anil Naidoo can sign off.",
    );
  });

  it("states the consequence with the last day to appeal, by the South African day", () => {
    const now = new Date("2026-09-22T12:05:00Z");
    expect(consequenceText(facts({}), now)).toBe(
      "Signing off releases 96 results to learners in 2026 Intake C now. Each learner is notified. Each learner's 7 days to appeal start now and end at the end of 29 Sept 2026. This cannot be undone.",
    );
  });

  it("records what happened, and what waits for the next cycle", () => {
    expect(
      signedOffText(
        facts({
          state: "signed_off",
          signed_off_at: "2026-09-22T12:05:00Z",
          signed_off_by_name: "Thabo Nkosi",
          released_count: 96,
          notified_count: 96,
        }),
      ),
    ).toBe("Signed off on 22 Sept 2026, 14:05 (SAST) by Thabo Nkosi. 96 results released. 96 notifications created.");
    expect(afterFreezeText(facts({ after_freeze: 11 }))).toBe(
      "11 newer decisions are waiting for the next cycle. They were finalised after the freeze and are not released by this sign-off.",
    );
    expect(afterFreezeText(facts({}))).toBeNull();
  });

  it("lays out the cycle's progress", () => {
    const steps = progressSteps(facts({ concluded: 20, blockers: [blocker({}), blocker({ item_id: "i2" })] }));
    expect(steps.map((step) => `${step.label}:${step.state}`)).toEqual([
      "Planned:complete",
      "Sampled:complete",
      "In review:current",
      "Waiting for re-marks:blocked",
      "Signed off:upcoming",
    ]);
    expect(progressSteps(facts({ state: "signed_off", signed_off_at: "2026-09-22T12:05:00Z" })).at(-1)?.state).toBe(
      "complete",
    );
  });
});
