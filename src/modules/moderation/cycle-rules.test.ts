import { describe, expect, it } from "vitest";
import {
  allocationsText,
  assessorsText,
  cycleStateText,
  holdCaution,
  holdDays,
  holdText,
  itemFateText,
  mandatoryText,
  periodText,
  poolLead,
  sampleShareText,
  samplingRuleText,
  scopeText,
  startText,
  type PoolSummary,
  cycleSteps,
  holdAlertText,
  moderatorsText,
  noModeratorText,
} from "./cycle-rules";

// 29 September 2026, 10:00 SAST.
const now = new Date("2026-09-29T08:00:00Z");

const summary = (over: Partial<PoolSummary> = {}): PoolSummary => ({
  moderation_policy: "moderated",
  max_hold_days: 21,
  sampling_percentage: 10,
  sampling_rule: "stratified",
  sampling_rule_version: 1,
  waiting: 0,
  oldest_waiting_at: null,
  held: 0,
  oldest_held_at: null,
  planned_cycles: 0,
  frozen_cycles: 0,
  ...over,
});

describe("planning on real data (S4-10)", () => {
  it("names the moderators with what they cannot be given (BR-01)", () => {
    expect(
      moderatorsText(
        [
          { profile_id: "a", full_name: "Anil Naidoo", assessed_waiting: 0, holds_open: 0 },
          { profile_id: "z", full_name: "Zanele Khumalo", assessed_waiting: 3, holds_open: 2 },
        ],
        96,
      ),
    ).toBe(
      "Anil Naidoo assessed none of the 96 waiting results, so can be given any of them. Zanele Khumalo assessed 3, so cannot be given those.",
    );
    expect(moderatorsText([], 4)).toMatch(/^No moderator's role covers this cohort/);
    expect(noModeratorText([{ title: "Task 3", unmoderatable: 0 }])).toBeNull();
    expect(
      noModeratorText([
        { title: "Task 3", unmoderatable: 2 },
        { title: "Task 4", unmoderatable: 0 },
      ]),
    ).toBe(
      "2 waiting results have no eligible moderator: every moderator of the cohort assessed them (2 for Task 3). If sampled, they wait for a moderator and block sign-off until the coordinator assigns one who assessed none of them.",
    );
  });

  it("raises the hold-age alert only past the maximum (P-03)", () => {
    const now = new Date("2026-09-29T10:00:00Z");
    const base = {
      moderation_policy: "moderated",
      max_hold_days: 21,
      sampling_percentage: 10,
      sampling_rule: "stratified",
      sampling_rule_version: 1,
      waiting: 1,
      oldest_waiting_at: "2026-09-20T10:00:00Z",
      held: 1,
      oldest_held_at: "2026-09-01T10:00:00Z",
      planned_cycles: 0,
      frozen_cycles: 1,
    };
    expect(holdAlertText(base, now)).toBe(
      "Past the 21-day maximum hold: the oldest result held in a frozen cycle was decided 28 days ago. The cycle holding it must be signed off.",
    );
    expect(holdAlertText({ ...base, oldest_held_at: null }, now)).toBeNull();
    expect(holdAlertText({ ...base, max_hold_days: null }, now)).toBeNull();
  });

  it("lays out a cycle's progress", () => {
    const steps = cycleSteps({
      state: "frozen",
      planned_by_name: "Ayesha Patel",
      planned_at: "2026-09-07T06:30:00Z",
      frozen_at: "2026-09-14T07:00:00Z",
      scheduled_start_at: "2026-09-14T07:00:00Z",
      sampled: 22,
      held: 96,
      concluded: 9,
      returned: 2,
      signed_off_at: null,
      signed_off_by_name: null,
      released_count: null,
      cancelled_at: null,
      cancelled_by_name: null,
    });
    expect(steps.map((step) => `${step.label}:${step.state}`)).toEqual([
      "Planned:complete",
      "Frozen and sampled:complete",
      "Waiting for re-marks:blocked",
      "Signed off:upcoming",
    ]);
    expect(steps[2].meta).toBe("9 of 22 concluded · 2 returned");
  });
});

describe("cycle wording", () => {
  it("says a cycle's state with its start", () => {
    expect(cycleStateText({ state: "planned", scheduled_start_at: "2026-10-05T07:00:00Z", held: 0 })).toBe(
      "Planned. Starts by itself on 05 Oct 2026, 09:00",
    );
    expect(cycleStateText({ state: "planned", scheduled_start_at: null, held: 0 })).toBe(
      "Planned. Freezes when you choose",
    );
    expect(cycleStateText({ state: "frozen", scheduled_start_at: null, held: 96 })).toBe(
      "Frozen and sampled. 96 results held",
    );
    expect(cycleStateText({ state: "cancelled", scheduled_start_at: null, held: 0 })).toBe("Cancelled before freeze");
    expect(startText("2026-10-05T07:00:00Z")).toBe("Automatically, 05 Oct 2026, 09:00");
    expect(startText(null)).toBe("When chosen");
  });

  it("says the scope: whole units first, then items named on their own", () => {
    const units = [{ id: "u4", code: "U4", title: "Communicate in the workplace" }];
    expect(
      scopeText(
        {
          unit_ids: ["u4"],
          items: [
            { id: "i4", title: "Task 4", via_unit_id: "u4" },
            { id: "i3", title: "Task 3", via_unit_id: null },
          ],
        },
        units,
      ),
    ).toBe("Unit U4: Communicate in the workplace (every assignment); Task 3");
    expect(scopeText({ unit_ids: [], items: [] }, units)).toBe("Nothing yet");
  });

  it("says the period, or nothing for the whole pool", () => {
    expect(periodText("2026-09-01", "2026-09-30")).toBe("Only results decided from 01 Sept 2026 to 30 Sept 2026");
    expect(periodText("2026-09-01", null)).toBe("Only results decided from 01 Sept 2026");
    expect(periodText(null, "2026-09-30")).toBe("Only results decided up to 30 Sept 2026");
    expect(periodText(null, null)).toBeNull();
  });
});

describe("hold age", () => {
  it("counts whole South African days against the maximum, and warns near it", () => {
    expect(holdDays("2026-09-25T15:00:00Z", now)).toBe(4);
    expect(holdDays(null, now)).toBe(0);
    expect(holdText(4, 21)).toBe("4 of 21 days");
    expect(holdText(1, null)).toBe("1 day");
    expect(holdCaution(17, 21)).toBe(false);
    expect(holdCaution(18, 21)).toBe(true);
    expect(holdCaution(30, null)).toBe(false);
  });
});

describe("pool wording", () => {
  it("names the assessors with their counts", () => {
    expect(
      assessorsText([
        { name: "Nomsa Dlamini", count: 2 },
        { name: "Zanele Khumalo", count: 1 },
      ]),
    ).toBe("Nomsa Dlamini 2 · Zanele Khumalo 1");
  });

  it("says what happens to an item's waiting results", () => {
    const base = { waiting: 3, open_cycle_name: null, open_cycle_state: null, open_cycle_scheduled_start_at: null };
    expect(itemFateText({ ...base, waiting: 0 })).toEqual({ text: "Nothing waiting", tone: "neutral" });
    expect(itemFateText(base)).toEqual({ text: "Not in any cycle", tone: "caution" });
    expect(
      itemFateText({
        ...base,
        open_cycle_name: "Term 3",
        open_cycle_state: "planned",
        open_cycle_scheduled_start_at: "2026-10-05T07:00:00Z",
      }),
    ).toEqual({ text: '"Term 3" claims them on 05 Oct 2026, 09:00', tone: "info" });
    expect(itemFateText({ ...base, open_cycle_name: "Term 3", open_cycle_state: "planned" })).toEqual({
      text: '"Term 3" claims them when it is frozen',
      tone: "info",
    });
    expect(itemFateText({ ...base, open_cycle_name: "Term 3", open_cycle_state: "frozen" })).toEqual({
      text: 'Waiting for the next cycle: "Term 3" is already frozen',
      tone: "caution",
    });
  });

  it("leads with the pool, its age and whether a cycle will release it", () => {
    expect(poolLead(summary({ moderation_policy: "not_moderated" }), now)).toMatch(/not moderated/);
    expect(poolLead(summary(), now)).toMatch(/Nothing is waiting right now/);
    expect(poolLead(summary({ waiting: 38, oldest_waiting_at: "2026-09-25T15:00:00Z" }), now)).toBe(
      "38 results are waiting for a cycle; the oldest was decided 4 days ago, on Friday 25 September 2026. No cycle is planned to release the waiting results.",
    );
    expect(
      poolLead(summary({ waiting: 1, oldest_waiting_at: "2026-09-29T07:00:00Z", planned_cycles: 1, held: 96 }), now),
    ).toBe(
      "1 result is waiting for a cycle; the oldest was decided today, on Tuesday 29 September 2026, and 96 results are held in a frozen cycle.",
    );
  });

  it("states the sampling rule in force", () => {
    expect(samplingRuleText(summary())).toBe(
      "Version 1: 10% of Competent results at random, stratified by assessor, outcome and unit; every Not yet competent decision and every first-time assessor's decisions.",
    );
  });
});

describe("sample record wording", () => {
  it("says the sample's share, the mandatory inclusions and who holds the items", () => {
    expect(sampleShareText(22, 96)).toBe("23% of the population");
    expect(sampleShareText(0, 0)).toBe("No population");
    expect(mandatoryText(6, 4)).toBe("6 Not yet competent · 4 by a first-time assessor");
    expect(mandatoryText(0, 0)).toBe("None");
    expect(
      allocationsText({ allocations: [{ moderator_name: "Anil Naidoo", count: 22 }], unallocated: 0, sample_size: 22 }),
    ).toBe("All 22 allocated to Anil Naidoo");
    expect(
      allocationsText({
        allocations: [
          { moderator_name: "Anil Naidoo", count: 2 },
          { moderator_name: "Thabo Nkosi", count: 1 },
        ],
        unallocated: 1,
        sample_size: 4,
      }),
    ).toBe("2 to Anil Naidoo, 1 to Thabo Nkosi; 1 waits for a moderator: everyone eligible assessed it");
  });
});
