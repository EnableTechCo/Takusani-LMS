import { describe, expect, it } from "vitest";
import { renderNotification } from "@/modules/notifications/templates";
import {
  coordinatorStateLabel,
  coordinatorsText,
  groundsCount,
  groundsError,
  learnerSteps,
  needsCoordinator,
  outcomeCategory,
  pointsText,
  turnaroundText,
} from "./rules";

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

describe("appeals administration (S3-02)", () => {
  it("tells the coordinator what each appeal needs from them", () => {
    expect(coordinatorStateLabel("remark", "lodged")).toBe("Needs your check");
    expect(coordinatorStateLabel("remark", "admitted")).toBe("Needs a reviewer");
    expect(coordinatorStateLabel("view_script", "admitted")).toBe("View granted");
    expect(coordinatorStateLabel("remark", "allocated")).toBe("With a reviewer");
    expect(needsCoordinator("remark", "admitted")).toBe(true);
    expect(needsCoordinator("view_script", "admitted")).toBe(false);
    expect(needsCoordinator("remark", "allocated")).toBe(false);
  });

  it("dates the learner's steps once they have happened", () => {
    const steps = learnerSteps({
      type: "remark",
      state: "allocated",
      lodgedAt: "2026-09-24T06:14:00Z",
      checkedAt: "2026-09-25T08:02:00Z",
      allocatedAt: "2026-09-25T08:20:00Z",
    });
    expect(steps.map((step) => [step.label, step.state, step.at ?? null])).toEqual([
      ["Received", "complete", "2026-09-24T06:14:00Z"],
      ["Being checked", "complete", null],
      ["Accepted", "complete", "2026-09-25T08:02:00Z"],
      ["With a reviewer", "complete", "2026-09-25T08:20:00Z"],
      ["Being reviewed", "current", null],
      ["Decided", "upcoming", null],
    ]);
    const refused = learnerSteps({
      type: "view_script",
      state: "inadmissible",
      lodgedAt: "2026-09-24T06:14:00Z",
      checkedAt: "2026-09-25T08:02:00Z",
    });
    expect(refused[2]).toMatchObject({ label: "Not accepted", at: "2026-09-25T08:02:00Z" });
  });

  it("tells the learner the outcome of the check, with the reason word for word (FR-605)", () => {
    const base = { reference: "APL-2026-0031", item_title: "Task 3", turnaround_working_days: 5 };
    expect(renderNotification("appeal_admitted", 1, { ...base, type: "remark" }).title).toBe(
      "Your appeal APL-2026-0031 was accepted",
    );
    expect(renderNotification("appeal_admitted", 1, { ...base, type: "view_script" }).title).toBe(
      "Your request to see your marked work was accepted",
    );
    const refused = renderNotification("appeal_inadmissible", 1, {
      ...base,
      type: "remark",
      reason: "It was lodged about a different task.",
    });
    expect(refused.title).toBe("Your appeal APL-2026-0031 was not accepted");
    expect(refused.paragraphs).toContain("The reason given: It was lodged about a different task.");
  });

  it("tells the reviewer what they have been given", () => {
    const allocated = renderNotification("appeal_review_allocated", 1, {
      reference: "APL-2026-0031",
      item_title: "Task 3",
      cohort_name: "2026 Intake B",
      learner_name: "Lerato Mokoena",
    });
    expect(allocated.title).toBe("Appeal APL-2026-0031 to review: Lerato Mokoena");
    expect(allocated.summary).toBe("A re-mark of Task 3 (2026 Intake B). Your decision is final.");
  });
});

describe("the reviewer's decision (S3-04, FR-610)", () => {
  it("follows the outcome first, then the total, as the database does", () => {
    expect(outcomeCategory("not_yet_competent", 11, "competent", 18)).toBe("amended_up");
    expect(outcomeCategory("competent", 18, "not_yet_competent", 18)).toBe("amended_down");
    expect(outcomeCategory("not_yet_competent", 11, "not_yet_competent", 13)).toBe("amended_up");
    expect(outcomeCategory("competent", 18, "competent", 16)).toBe("amended_down");
    expect(outcomeCategory("competent", 18, "competent", 18)).toBe("upheld");
    expect(outcomeCategory("competent", null, "competent", null)).toBe("upheld");
  });

  it("tells the learner it is decided and final, without naming the reviewer", () => {
    const decided = renderNotification("appeal_decided", 1, {
      reference: "APL-2026-0031",
      item_title: "Task 3",
      category: "amended_up",
      outcome: "competent",
    });
    expect(decided.title).toBe("Your appeal APL-2026-0031 has been decided");
    expect(decided.summary).toBe("Mark changed: higher. The decision is final.");
    expect(decided.paragraphs.join(" ")).toContain("A reviewer who did not mark your work");
  });

  it("tells the assessor and coordinator the outcome and who decided", () => {
    const concluded = renderNotification("appeal_concluded", 1, {
      reference: "APL-2026-0031",
      learner_name: "Lerato Mokoena",
      item_title: "Task 3",
      cohort_name: "2026 Intake B",
      reviewer_name: "Zanele Khumalo",
      category: "amended_down",
      outcome: "not_yet_competent",
    });
    expect(concluded.title).toBe("Appeal APL-2026-0031 decided: amended downward");
    expect(concluded.paragraphs[1]).toBe(
      "The outcome is now Not yet competent (amended downward). It is released to the learner and is final. The earlier decision stays on record.",
    );
  });
});
