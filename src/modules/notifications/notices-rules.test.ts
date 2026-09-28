import { describe, expect, it } from "vitest";
import { audienceLabel, noticeStateLabel } from "./notices-rules";
import { renderNotification } from "./templates";

describe("notices (FR-703)", () => {
  it("say who a notice is for", () => {
    expect(audienceLabel({ audience: "cohort", cohort_name: "2026 Intake B", role: null })).toBe(
      "Learners in 2026 Intake B",
    );
    expect(audienceLabel({ audience: "role", cohort_name: null, role: "assessor" })).toBe("All assessors");
    expect(audienceLabel({ audience: "everyone", cohort_name: null, role: null })).toBe("Everyone");
    expect(noticeStateLabel("scheduled")).toBe("Scheduled");
  });

  it("name the sender, and keep the summary to one short line", () => {
    const short = renderNotification("notice", 1, {
      title: "Venue change",
      body: "We have moved to Training Room 2.\n\nLunch is provided.",
      sender_name: "Zanele Dlamini",
    });
    expect(short.title).toBe("Notice from Zanele Dlamini: Venue change");
    expect(short.paragraphs).toEqual(["We have moved to Training Room 2.", "Lunch is provided."]);

    const long = renderNotification("notice", 1, { title: "Long", body: "x".repeat(400), sender_name: "Z" });
    expect(long.summary.length).toBe(160);
    expect(long.summary.endsWith("...")).toBe(true);
  });
});
