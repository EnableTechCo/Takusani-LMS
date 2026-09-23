import { describe, expect, it } from "vitest";
import {
  beingAssessed,
  doNext,
  firstName,
  greeting,
  newResults,
  summaryLine,
  type HomeResult,
  type HomeTask,
} from "./home-rules";

const now = new Date("2026-09-23T10:00:00+02:00");

const task = (overrides: Partial<HomeTask>): HomeTask => ({
  id: "t",
  title: "Task",
  cohort_name: "2026 Intake B",
  due_at: "2026-10-02T17:00:00+02:00",
  late_policy: "accept_and_flag",
  latest_version: null,
  latest_submitted_at: null,
  ...overrides,
});

const released = (overrides: Partial<HomeResult>): HomeResult => ({
  result_id: "r",
  task_id: "t3",
  item_title: "Task 3",
  state: "released",
  outcome: "not_yet_competent",
  released_at: "2026-09-22T14:05:00+02:00",
  appeal_deadline_at: "2026-09-30T00:00:00+02:00",
  remediation_deadline_at: "2026-10-06T14:05:00+02:00",
  ...overrides,
});

const handedIn = task({
  id: "t3",
  title: "Task 3",
  latest_version: 1,
  latest_submitted_at: "2026-09-04T17:42:00+02:00",
});

describe("doNext", () => {
  it("lists work not handed in and open resubmissions, overdue first, then soonest", () => {
    const items = doNext(
      [
        task({ id: "later", title: "Task 5", due_at: "2026-10-09T17:00:00+02:00" }),
        task({ id: "overdue", title: "Task 2", due_at: "2026-09-20T17:00:00+02:00" }),
        task({ id: "soon", title: "Task 4", due_at: "2026-09-25T17:00:00+02:00" }),
        handedIn,
      ],
      [released({})],
      now,
    );
    expect(items.map((item) => [item.taskId, item.status])).toEqual([
      ["overdue", "overdue"],
      ["soon", "not_started"],
      ["t3", "resubmission_open"],
      ["later", "not_started"],
    ]);
    expect(items[2].href).toBe("/learn/results/r");
  });

  it("leaves out a task that closed at its due time, and a resubmission already handed in", () => {
    const closed = task({ id: "closed", late_policy: "closed_at_due", due_at: "2026-09-20T17:00:00+02:00" });
    const resubmitted = { ...handedIn, latest_version: 2, latest_submitted_at: "2026-09-23T08:00:00+02:00" };
    expect(doNext([closed, resubmitted], [released({})], now)).toEqual([]);
  });

  it("leaves out a resubmission whose time has ended", () => {
    expect(doNext([handedIn], [released({ remediation_deadline_at: "2026-09-23T09:00:00+02:00" })], now)).toEqual([]);
  });
});

describe("newResults", () => {
  it("shows a released result while its appeal window or resubmission period is open", () => {
    expect(newResults([released({})], [handedIn], now)).toEqual([
      { result: released({}), appealOpen: true, resubmitUntil: "2026-10-06T14:05:00+02:00" },
    ]);
  });

  it("drops it once both have closed, and never shows a held result", () => {
    const old = released({ appeal_deadline_at: "2026-09-20T00:00:00+02:00", outcome: "competent" });
    const held = released({ state: "held", outcome: null, released_at: null, appeal_deadline_at: null });
    expect(newResults([old, held], [handedIn], now)).toEqual([]);
  });

  it("keeps a result with an open resubmission even after its appeal window closes", () => {
    const item = newResults([released({ appeal_deadline_at: "2026-09-20T00:00:00+02:00" })], [handedIn], now)[0];
    expect(item).toMatchObject({ appealOpen: false, resubmitUntil: "2026-10-06T14:05:00+02:00" });
  });
});

describe("beingAssessed", () => {
  it("lists held results, and resubmissions handed in after a release, with the version", () => {
    const held = released({ result_id: "h", task_id: "t4", item_title: "Task 4", state: "held", outcome: null });
    const task4 = task({ id: "t4", latest_version: 1, latest_submitted_at: "2026-09-21T09:00:00+02:00" });
    const resubmitted = { ...handedIn, latest_version: 2, latest_submitted_at: "2026-09-23T08:00:00+02:00" };
    expect(beingAssessed([task4, resubmitted], [held, released({})])).toEqual([
      { resultId: "r", title: "Task 3", version: 2, submittedAt: "2026-09-23T08:00:00+02:00" },
      { resultId: "h", title: "Task 4", version: 1, submittedAt: "2026-09-21T09:00:00+02:00" },
    ]);
  });

  it("does not list a released result nobody has resubmitted", () => {
    expect(beingAssessed([handedIn], [released({})])).toEqual([]);
  });
});

describe("the header", () => {
  it("greets by the time of day in South Africa", () => {
    expect(greeting(new Date("2026-09-23T06:30:00Z"))).toBe("Good morning");
    expect(greeting(new Date("2026-09-23T12:00:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-09-23T16:00:00Z"))).toBe("Good evening");
  });

  it("uses the first name", () => {
    expect(firstName("Lerato Mokoena")).toBe("Lerato");
  });

  it("sums up what is new and what needs doing", () => {
    const fresh = newResults([released({})], [handedIn], now);
    const todo = doNext([task({})], [], now);
    expect(summaryLine(fresh, todo)).toBe(
      "Your result for Task 3 is ready, and one piece of work needs your attention.",
    );
    expect(summaryLine([], [...todo, ...todo])).toBe("2 pieces of work need your attention.");
    expect(summaryLine([], [])).toBe("Nothing needs you right now. New work and results will show here.");
  });
});
