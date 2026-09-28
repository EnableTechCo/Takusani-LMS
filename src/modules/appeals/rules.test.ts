import { describe, expect, it } from "vitest";
import { renderNotification } from "@/modules/notifications/templates";
import { coordinatorsText, groundsCount, groundsError, learnerSteps, pointsText, turnaroundText } from "./rules";

describe("appeal grounds (FR-602)", () => {
  it("are required, at least 50 characters and at most 2000, as the database checks", () => {
    expect(groundsError("   ")).toMatch(/Enter your reasons/);
    expect(groundsError("x".repeat(49))).toMatch(/at least 50/);
    expect(groundsError("x".repeat(50))).toBeNull();
    expect(groundsError("x".repeat(2001))).toMatch(/longer than 2000/);
  });

  it("count as the learner types, saying how many more are needed", () => {
    expect(groundsCount("")).toBe("0 / 2000 characters");
    expect(groundsCount("x".repeat(40))).toBe("40 / 2000 characters. 10 more needed");
    expect(groundsCount("x".repeat(334))).toBe("334 / 2000 characters");
  });
});

describe("appeal words", () => {
  it("name the coordinators who check it", () => {
    expect(coordinatorsText([])).toBe("your coordinator");
    expect(coordinatorsText(["Ayesha Patel"])).toBe("your coordinator, Ayesha Patel");
    expect(coordinatorsText(["Ayesha Patel", "Zanele Khumalo"])).toBe(
      "your coordinators, Ayesha Patel and Zanele Khumalo",
    );
  });

  it("label the turnaround as working days, and marks as a total", () => {
    expect(turnaroundText(5)).toBe("within 5 working days");
    expect(pointsText(5, 8)).toBe("5 of 8");
    expect(pointsText(null, null)).toBeNull();
  });
});

describe("the learner's timeline (FR-612)", () => {
  const lodgedAt = "2026-09-24T08:14:00+02:00";
  const states = (steps: ReturnType<typeof learnerSteps>) => steps.map((step) => `${step.label}: ${step.state}`);

  it("shows a new re-mark as received and being checked", () => {
    expect(states(learnerSteps({ type: "remark", state: "lodged", lodgedAt }))).toEqual([
      "Received: complete",
      "Being checked: current",
      "Accepted: upcoming",
      "With a reviewer: upcoming",
      "Being reviewed: upcoming",
      "Decided: upcoming",
    ]);
  });

  it("moves on as the re-mark is accepted, allocated and decided", () => {
    const current = (state: "admitted" | "allocated" | "under_review" | "concluded") =>
      learnerSteps({ type: "remark", state, lodgedAt }).find((step) => step.state === "current")?.label ?? null;
    expect(current("admitted")).toBe("With a reviewer");
    expect(current("allocated")).toBe("Being reviewed");
    expect(current("under_review")).toBe("Being reviewed");
    expect(current("concluded")).toBeNull();
  });

  it("is shorter for a request to see the marked work, and ends at Not accepted when refused", () => {
    expect(states(learnerSteps({ type: "view_script", state: "lodged", lodgedAt }))).toEqual([
      "Received: complete",
      "Being checked: current",
      "Accepted: see your marked work: upcoming",
    ]);
    expect(states(learnerSteps({ type: "remark", state: "inadmissible", lodgedAt }))).toEqual([
      "Received: complete",
      "Being checked: complete",
      "Not accepted: complete",
    ]);
  });
});

describe("appeal notifications (FR-604)", () => {
  it("give the learner the reference and the turnaround", () => {
    const receipt = renderNotification("appeal_received", 1, {
      reference: "APL-2026-0031",
      item_title: "Task 3",
      type: "remark",
      lodged_at: "2026-09-24T06:14:00Z",
      turnaround_working_days: 5,
    });
    expect(receipt.title).toBe("We have received your appeal APL-2026-0031");
    expect(receipt.summary).toBe("About Task 3. You should hear from us within 5 working days.");
    expect(receipt.paragraphs[1]).toMatch(/^You asked for your work to be marked again\./);
    expect(receipt.paragraphs[0]).toBe(
      "We received your appeal APL-2026-0031 about Task 3 on Thursday 24 September 2026 at 08:14 (SAST). It was lodged in time.",
    );
  });

  it("tell each coordinator it needs their check", () => {
    const alert = renderNotification("appeal_lodged", 1, {
      reference: "APL-2026-0031",
      learner_name: "Lerato Mokoena",
      item_title: "Task 3",
      cohort_name: "2026 Intake B",
      type: "view_script",
      lodged_at: "2026-09-24T06:14:00Z",
    });
    expect(alert.title).toBe("New appeal APL-2026-0031 from Lerato Mokoena");
    expect(alert.summary).toBe(
      "Lerato Mokoena asked to see the marked work for Task 3 (2026 Intake B). It needs your check.",
    );
  });
});
