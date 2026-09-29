import { describe, expect, it } from "vitest";
import {
  appealsWaiting,
  coordinateLead,
  openReadiness,
  queriesNeedingAttention,
  variancesToReconcile,
} from "./coordinate-overview-rules";

const today = "2026-09-29";

describe("appealsWaiting", () => {
  it("keeps appeals the coordinator must act on, longest waiting first", () => {
    const appeal = (over: Record<string, unknown>) => ({
      id: "a",
      reference: "APL-1",
      learner_name: "Lerato",
      item_title: "Task 3",
      cohort_name: "Intake B",
      type: "remark",
      state: "lodged",
      lodged_at: "2026-09-20T10:00:00Z",
      ...over,
    });
    const rows = [
      appeal({ id: "newer", lodged_at: "2026-09-25T10:00:00Z" }),
      appeal({ id: "with-reviewer", state: "allocated" }),
      appeal({ id: "needs-reviewer", state: "admitted", lodged_at: "2026-09-22T10:00:00Z" }),
      appeal({ id: "view-granted", state: "admitted", type: "view" }),
      appeal({ id: "oldest" }),
    ];
    expect(appealsWaiting(rows).map((row) => row.id)).toEqual(["oldest", "needs-reviewer", "newer"]);
  });
});

describe("openReadiness", () => {
  it("lists open items of cohorts in setup: overdue first, then soonest due, undated last", () => {
    const cohorts = [
      { id: "b", name: "Intake B", status: "setup" },
      { id: "a", name: "Intake A", status: "setup" },
      { id: "x", name: "Intake X", status: "active" },
    ];
    const items = openReadiness(
      cohorts,
      {
        a: [
          { item_key: "learners", done: false, due_on: "2026-10-01", assignee_name: "Ayesha", gate: true },
          { item_key: "materials", done: true, due_on: null, assignee_name: null, gate: false },
        ],
        b: [
          { item_key: "assessor", done: false, due_on: "2026-09-20", assignee_name: null, gate: true },
          { item_key: "sessions", done: false, due_on: null, assignee_name: null, gate: false },
        ],
        x: [{ item_key: "learners", done: false, due_on: "2026-09-01", assignee_name: null, gate: true }],
      },
      today,
    );
    expect(items.map((item) => `${item.cohortName}: ${item.label}`)).toEqual([
      "Intake B: At least one assessor assigned",
      "Intake A: Learners enrolled",
      "Intake B: A session scheduled",
    ]);
    expect(items[0].overdue).toBe(true);
    expect(items[1].overdue).toBe(false);
  });
});

describe("variancesToReconcile", () => {
  it("keeps flagged sessions that are not cancelled, latest first", () => {
    const row = (over: Record<string, unknown>) => ({
      session_id: "s",
      title: "Filing",
      cohort_name: "Intake B",
      starts_at: "2026-09-20T09:00:00+02:00",
      session_state: "scheduled",
      variance_flagged: true,
      present: 12,
      headcount: 20,
      ...over,
    });
    const rows = [
      row({ session_id: "older" }),
      row({ session_id: "fine", variance_flagged: false }),
      row({ session_id: "cancelled", session_state: "cancelled" }),
      row({ session_id: "newer", starts_at: "2026-09-25T09:00:00+02:00" }),
    ];
    expect(variancesToReconcile(rows).map((r) => r.session_id)).toEqual(["newer", "older"]);
  });
});

describe("queriesNeedingAttention", () => {
  it("lists unrouted open queries first, then overdue ones, longest logged first", () => {
    const query = (over: Record<string, unknown>) => ({
      id: "q",
      reference: "QRY-1",
      subject: "Certificates",
      source_name: "Employer",
      state: "open",
      owner_id: "owner",
      due_on: "2026-10-05",
      logged_at: "2026-09-10T10:00:00Z",
      ...over,
    });
    const rows = [
      query({ id: "overdue", due_on: "2026-09-28" }),
      query({ id: "fine" }),
      query({ id: "closed-overdue", state: "closed", due_on: "2026-09-01" }),
      query({ id: "unrouted-new", owner_id: null, logged_at: "2026-09-20T10:00:00Z" }),
      query({ id: "unrouted-old", owner_id: null, logged_at: "2026-09-01T10:00:00Z" }),
      query({ id: "due-today", due_on: today }),
    ];
    const items = queriesNeedingAttention(rows, today);
    expect(items.map((item) => `${item.id}:${item.attention}`)).toEqual([
      "unrouted-old:not_routed",
      "unrouted-new:not_routed",
      "overdue:overdue",
    ]);
  });
});

describe("coordinateLead", () => {
  it("says what needs attention in one sentence", () => {
    expect(coordinateLead({ appeals: 0, readiness: 0, variances: 0, queries: 0 })).toBe(
      "Nothing needs your attention right now.",
    );
    expect(coordinateLead({ appeals: 1, readiness: 0, variances: 0, queries: 0 })).toBe("1 appeal needs you.");
    expect(coordinateLead({ appeals: 2, readiness: 3, variances: 1, queries: 0 })).toBe(
      "2 appeals need you, 3 setup items are open, and 1 attendance difference to reconcile.",
    );
  });
});
