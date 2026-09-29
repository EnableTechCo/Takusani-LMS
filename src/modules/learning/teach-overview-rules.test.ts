import { describe, expect, it } from "vitest";
import {
  outstandingWork,
  sessionsComingUp,
  sessionsToday,
  teachLead,
  workSummary,
  type OverviewSession,
} from "./teach-overview-rules";

// 29 September 2026, 10:00 SAST.
const now = new Date("2026-09-29T08:00:00Z");

const session = (over: Partial<OverviewSession>): OverviewSession => ({
  id: "s",
  title: "Session",
  cohort_name: "2026 Intake B",
  starts_at: "2026-09-29T12:00:00+02:00",
  duration_minutes: 60,
  mode: "online",
  teams_url: "https://teams.microsoft.com/l/meetup-join/x",
  venue: null,
  state: "scheduled",
  audience: 20,
  ...over,
});

describe("sessionsToday", () => {
  it("lists the day's sessions in South African time, earliest first, without cancelled ones", () => {
    const rows = [
      session({ id: "late", starts_at: "2026-09-29T16:00:00+02:00" }),
      session({ id: "early", starts_at: "2026-09-29T01:00:00+02:00" }), // 23:00 UTC the day before
      session({ id: "tomorrow", starts_at: "2026-09-30T00:30:00+02:00" }), // still 29 Sept in UTC
      session({ id: "cancelled", state: "cancelled" }),
    ];
    expect(sessionsToday(rows, now).map((row) => row.id)).toEqual(["early", "late"]);
  });
});

describe("sessionsComingUp", () => {
  it("takes the next seven days after today, soonest first", () => {
    const rows = [
      session({ id: "today" }),
      session({ id: "next-week", starts_at: "2026-10-05T09:00:00+02:00" }),
      session({ id: "tomorrow", starts_at: "2026-09-30T09:00:00+02:00" }),
      session({ id: "too-far", starts_at: "2026-10-07T09:00:00+02:00" }),
    ];
    expect(sessionsComingUp(rows, now).map((row) => row.id)).toEqual(["tomorrow", "next-week"]);
  });
});

const task = (over: Record<string, unknown>) => ({
  task_id: "t",
  title: "Task",
  due_at: "2026-10-05T17:00:00+02:00",
  audience: 20,
  submitted: 15,
  outstanding: 5,
  late: 0,
  cohort_id: "c",
  cohort_name: "2026 Intake B",
  ...over,
});

describe("outstandingWork", () => {
  it("keeps tasks with work outstanding: overdue first, then soonest due, no due time last", () => {
    const rows = [
      task({ task_id: "done", outstanding: 0 }),
      task({ task_id: "no-due", due_at: null }),
      task({ task_id: "soon", due_at: "2026-10-01T17:00:00+02:00" }),
      task({ task_id: "overdue", due_at: "2026-09-20T17:00:00+02:00", late: 2 }),
      task({ task_id: "later" }),
    ];
    const items = outstandingWork(rows, now);
    expect(items.map((item) => item.task_id)).toEqual(["overdue", "soon", "later", "no-due"]);
    expect(items[0].overdue).toBe(true);
    expect(items[1].overdue).toBe(false);
  });
});

describe("workSummary and teachLead", () => {
  it("adds up the figures and says them in words", () => {
    const items = outstandingWork(
      [task({ task_id: "a", due_at: "2026-09-20T17:00:00+02:00", late: 2 }), task({ task_id: "b", outstanding: 3 })],
      now,
    );
    expect(workSummary(items)).toEqual({ tasks: 2, outstanding: 8, late: 2 });
    expect(teachLead(1, items)).toBe("1 session today, and 2 tasks with work outstanding, 1 past due.");
    expect(teachLead(0, items.slice(1))).toBe("1 task with work outstanding.");
    expect(teachLead(2, [])).toBe("2 sessions today.");
    expect(teachLead(0, [])).toBe("No sessions today, and every task set has been handed in.");
  });
});
