import { describe, expect, it } from "vitest";
import {
  draftChanges,
  freezeConsequence,
  frozenText,
  pairName,
  pairsFromForm,
  requiredTitles,
  requirementText,
  startingPairs,
  type RequirementItem,
  type RequirementSet,
} from "./requirement-rules";

const items: RequirementItem[] = [
  { item_id: "i3", title: "Task 3: Portfolio", kind: "task", suggested_unit_id: "u3" },
  { item_id: "i4", title: "Task 4: Letter", kind: "task", suggested_unit_id: null },
];

const set = (over: Partial<RequirementSet>): RequirementSet => ({
  requirement_set_id: "s1",
  version: 1,
  frozen_at: "2026-09-29T10:00:00Z",
  frozen_by_name: "Ayesha Patel",
  created_by_name: "Ayesha Patel",
  updated_at: "2026-09-29T10:00:00Z",
  reason: null,
  in_force: true,
  awards: 0,
  requirements: [],
  ...over,
});

describe("unit credit requirements", () => {
  it("round-trips the checkbox names of the draft form", () => {
    expect(pairName("u3", "i4")).toBe("req:u3:i4");
    expect(pairsFromForm(["req:u3:i3", "req:u4:i4", "$ACTION_ID_1", "req:broken"])).toEqual([
      { unit_id: "u3", assessable_item_id: "i3" },
      { unit_id: "u4", assessable_item_id: "i4" },
    ]);
  });

  it("starts the draft form from the draft, else the version in force, else each assessment's module", () => {
    const inForce = set({ requirements: [{ unit_id: "u3", assessable_item_id: "i4" }] });
    const draft = set({ requirement_set_id: "s2", version: 2, frozen_at: null, in_force: false, requirements: [] });
    expect(startingPairs([inForce, draft], items)).toEqual([]);
    expect(startingPairs([inForce], items)).toEqual([{ unit_id: "u3", assessable_item_id: "i4" }]);
    expect(startingPairs([], items)).toEqual([{ unit_id: "u3", assessable_item_id: "i3" }]);
  });

  it("says what a unit needs", () => {
    const both = set({
      requirements: [
        { unit_id: "u3", assessable_item_id: "i4" },
        { unit_id: "u3", assessable_item_id: "i3" },
        { unit_id: "u4", assessable_item_id: "i4" },
      ],
    });
    expect(requiredTitles(both, "u3", items)).toEqual(["Task 3: Portfolio", "Task 4: Letter"]);
    expect(requirementText(requiredTitles(both, "u3", items))).toBe(
      "Needs Task 3: Portfolio and Task 4: Letter released Competent.",
    );
    expect(requirementText(["A", "B", "C"])).toBe("Needs A, B and C released Competent.");
    expect(requirementText([])).toBe("Requires nothing in this version, so it is not awarded from this cohort.");
  });

  it("counts what a draft changes against the version in force", () => {
    const inForce = set({
      requirements: [
        { unit_id: "u3", assessable_item_id: "i3" },
        { unit_id: "u3", assessable_item_id: "i4" },
      ],
    });
    const draft = set({
      frozen_at: null,
      requirements: [
        { unit_id: "u3", assessable_item_id: "i3" },
        { unit_id: "u4", assessable_item_id: "i4" },
      ],
    });
    expect(draftChanges(inForce, draft)).toEqual({ added: 1, removed: 1 });
    expect(draftChanges(undefined, draft)).toEqual({ added: 2, removed: 0 });
  });

  it("explains freezing, and that awards already made stand when the requirements change", () => {
    expect(freezeConsequence(1, false)).toMatch(/^Version 1 cannot be edited once frozen\./);
    expect(freezeConsequence(2, true)).toMatch(/Awards already made stand/);
    expect(frozenText(1, 0)).toBe(
      "Version 1 is in force. The freeze awarded nothing new; credits are awarded as results are released.",
    );
    expect(frozenText(2, 1)).toBe("Version 2 is in force. 1 unit was awarded to learners who already met it.");
    expect(frozenText(2, 3)).toBe("Version 2 is in force. 3 units were awarded to learners who already met them.");
  });
});
