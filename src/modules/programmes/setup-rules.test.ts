import { describe, expect, it } from "vitest";
import { readinessDetail, unreleasedText } from "./setup-rules";

describe("cohort setup wording", () => {
  it("counts what the checklist found", () => {
    expect(readinessDetail("learners", "1", "moderated")).toBe("1 learner");
    expect(readinessDetail("assessor", "3", "moderated")).toBe("3 assessors");
    expect(readinessDetail("published_tasks", "0", null)).toBe("0 assignments");
    expect(readinessDetail("moderation_policy", "not_moderated", "not_moderated")).toBe("Not moderated");
    expect(readinessDetail("logistics", null, null)).toBeNull();
    expect(readinessDetail("logistics", "1/3", null)).toBe("1 of 3 in-person sessions arranged");
    expect(readinessDetail("logistics", "0/1", null)).toBe("0 of 1 in-person session arranged");
    expect(readinessDetail("logistics", "none_in_person", null)).toBe("No in-person sessions, so nothing to arrange");
  });

  it("says a moderator is not needed for a cohort that is not moderated", () => {
    expect(readinessDetail("moderator", "0", "not_moderated")).toBe("Not needed: not moderated");
    expect(readinessDetail("moderator", "0", "moderated")).toBe("0 moderators");
  });

  it("names the results that block dropping moderation", () => {
    expect(unreleasedText(14, 96)).toBe(
      "14 results are decided and waiting for a moderation cycle, and 96 are held in a cycle",
    );
    expect(unreleasedText(1, 0)).toBe("1 result is decided and waiting for a moderation cycle");
    expect(unreleasedText(0, 1)).toBe("1 is held in a cycle");
  });
});
