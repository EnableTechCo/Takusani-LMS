import { describe, expect, it } from "vitest";
import { conflictText, inclusionText, itemPositionText, itemStateTone, progressText } from "./review-rules";

describe("review wording", () => {
  it("says why an item is in the sample", () => {
    expect(inclusionText("nyc", "Not yet competent", "Zanele Khumalo")).toMatch(/Every Not yet competent decision/);
    expect(inclusionText("first_time_assessor", "First-time assessor: Nomsa Dlamini", "Nomsa Dlamini")).toBe(
      "Nomsa Dlamini has no decision in an earlier signed-off cycle, so every decision of theirs is sampled.",
    );
    expect(inclusionText("random", "Nomsa Dlamini · Competent · Unit U3", "Nomsa Dlamini")).toBe(
      'Drawn at random within the stratum "Nomsa Dlamini · Competent · Unit U3".',
    );
  });

  it("numbers items and counts progress", () => {
    expect(itemPositionText(7, 22)).toBe("Item 7 of 22");
    expect(progressText(15, 18)).toBe("15 of your 18 items are concluded.");
    expect(progressText(1, 1)).toBe("All 1 of your item is concluded.");
    expect(progressText(0, 0)).toBe("You hold no items in this cycle.");
  });

  it("gives each state its tone", () => {
    expect(itemStateTone("agreed")).toBe("positive");
    expect(itemStateTone("disagreed")).toBe("caution");
    expect(itemStateTone("allocated")).toBe("info");
    expect(itemStateTone("unallocated")).toBe("neutral");
  });

  it("names the conflicting decision", () => {
    expect(
      conflictText(
        [{ actor_name: "Zanele Khumalo", outcome: "not_yet_competent", decided_at: "2026-09-27T13:40:00Z" }],
        (iso) => iso,
      ),
    ).toBe(
      "Zanele Khumalo decided Not yet competent on 2026-09-27T13:40:00Z (SAST), so they cannot moderate it (BR-01).",
    );
    expect(conflictText(null, (iso) => iso)).toBe("They took an assessment decision on this result.");
  });
});
