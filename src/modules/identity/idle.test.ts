import { describe, expect, it } from "vitest";
import { formatCountdown, idlePhase, latestActivity, signOutPath, WARN_BEFORE_MS } from "./idle";

const MINUTE = 60 * 1000;

describe("idlePhase", () => {
  it("is active until two minutes before the limit", () => {
    expect(idlePhase(0, 27 * MINUTE, 30)).toEqual({ phase: "active" });
    expect(idlePhase(0, 28 * MINUTE - 1, 30)).toEqual({ phase: "active" });
  });

  it("warns with at least two minutes' notice (A11Y-07)", () => {
    expect(idlePhase(0, 28 * MINUTE, 30)).toEqual({ phase: "warning", msLeft: WARN_BEFORE_MS });
    expect(idlePhase(0, 29 * MINUTE + 59 * 1000, 30)).toEqual({ phase: "warning", msLeft: 1000 });
  });

  it("expires at the limit", () => {
    expect(idlePhase(0, 30 * MINUTE, 30)).toEqual({ phase: "expired" });
    expect(idlePhase(0, 90 * MINUTE, 30)).toEqual({ phase: "expired" });
  });

  it("never expires without a limit", () => {
    expect(idlePhase(0, 1000 * MINUTE, 0)).toEqual({ phase: "active" });
    expect(idlePhase(0, 1000 * MINUTE, Number.NaN)).toEqual({ phase: "active" });
  });
});

describe("formatCountdown", () => {
  it("shows minutes and seconds, rounding up so it never shows 0:00 early", () => {
    expect(formatCountdown(WARN_BEFORE_MS)).toBe("2:00");
    expect(formatCountdown(105_000)).toBe("1:45");
    expect(formatCountdown(8_200)).toBe("0:09");
    expect(formatCountdown(-5)).toBe("0:00");
  });
});

describe("latestActivity", () => {
  it("takes the later of this tab's activity and another tab's", () => {
    expect(latestActivity(100, "250")).toBe(250);
    expect(latestActivity(300, "250")).toBe(300);
  });

  it("ignores a missing or unreadable shared value", () => {
    expect(latestActivity(100, null)).toBe(100);
    expect(latestActivity(100, "later")).toBe(100);
  });
});

describe("signOutPath", () => {
  it("says why, and returns to the same page after signing in", () => {
    expect(signOutPath("/assess/instances/abc?tab=rubric")).toBe(
      "/auth/sign-out?reason=idle&next=%2Fassess%2Finstances%2Fabc%3Ftab%3Drubric",
    );
  });

  it("never carries a path to another site", () => {
    expect(signOutPath("//evil.example")).toBe("/auth/sign-out?reason=idle");
  });
});
