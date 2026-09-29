import { describe, expect, it } from "vitest";
import {
  conflictText,
  dueText,
  earliestDueOn,
  inclusionText,
  isOverdue,
  itemPositionText,
  itemStateTone,
  needsReview,
  progressText,
} from "./review-rules";

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

  it("gives each state its tone, and says which still need the moderator", () => {
    expect(itemStateTone("agreed")).toBe("positive");
    expect(itemStateTone("returned")).toBe("caution");
    expect(itemStateTone("allocated")).toBe("info");
    expect(itemStateTone("remarked")).toBe("info");
    expect(itemStateTone("unallocated")).toBe("neutral");
    expect(["allocated", "remarked"].every(needsReview)).toBe(true);
    expect(["agreed", "returned", "unallocated"].some(needsReview)).toBe(false);
  });

  it("puts a return's deadline into words, by the South African day", () => {
    const now = new Date("2026-09-29T23:30:00Z"); // already 30 September in Johannesburg
    expect(dueText("2026-10-06", now)).toBe("Due 06 Oct 2026");
    expect(dueText("2026-09-30", now)).toBe("Due today");
    expect(dueText("2026-09-29", now)).toBe("1 day overdue");
    expect(dueText("2026-09-27", now)).toBe("3 days overdue");
    expect(isOverdue("2026-09-29", now)).toBe(true);
    expect(isOverdue("2026-09-30", now)).toBe(false);
    expect(earliestDueOn(now)).toBe("2026-10-01");
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
