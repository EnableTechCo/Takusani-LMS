import { describe, expect, it } from "vitest";
import { effectiveText, fromText, rangeText, valueText } from "./configuration-rules";

const days = { value_type: "integer", unit_label: "days", choices: null };
const percent = { value_type: "integer", unit_label: "%", choices: null };
const policy = {
  value_type: "choice",
  unit_label: null,
  choices: [
    { value: "accept_and_flag", label: "Accept and flag as late" },
    { value: "refuse", label: "Refuse after the deadline" },
  ],
};

describe("configuration values", () => {
  it("shows a number with its unit", () => {
    expect(valueText(days, 7)).toBe("7 days");
    expect(valueText(percent, 15)).toBe("15%");
    expect(valueText({ value_type: "integer", unit_label: null, choices: null }, 3)).toBe("3");
  });

  it("shows a choice by its label, and an unknown choice as stored", () => {
    expect(valueText(policy, "refuse")).toBe("Refuse after the deadline");
    expect(valueText(policy, "other")).toBe("other");
  });

  it("says None for a missing value", () => {
    expect(valueText(days, null)).toBe("None");
    expect(valueText(days, undefined)).toBe("None");
  });
});

describe("when a version applies", () => {
  it("says the first values apply from the start", () => {
    expect(effectiveText(null)).toBe("From the start");
  });

  it("names the day for a change dated to a day", () => {
    expect(effectiveText("2026-10-01T00:00:00+02:00")).toBe("Start of Thursday 1 October 2026");
  });

  it("gives the day and time for a change made now", () => {
    expect(effectiveText("2026-09-28T12:39:00+02:00")).toBe("Monday 28 September 2026 at 12:39 (SAST)");
  });

  it("reads inside a sentence", () => {
    expect(fromText(null)).toBe("from the start");
    expect(fromText("2026-10-01T00:00:00+02:00")).toBe("from the start of Thursday 1 October 2026");
    expect(fromText("2026-09-28T12:39:00+02:00")).toBe("from Monday 28 September 2026 at 12:39 (SAST)");
  });
});

describe("allowed range", () => {
  it("describes the range, with a unit other than percent", () => {
    expect(rangeText(1, 30, "days")).toBe("A whole number from 1 to 30 (days).");
    expect(rangeText(0, 100, "%")).toBe("A whole number from 0 to 100.");
    expect(rangeText(null, 30, "days")).toBe("");
  });
});
