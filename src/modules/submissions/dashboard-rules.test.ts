import { describe, expect, it } from "vitest";
import { renderNotification } from "@/modules/notifications/templates";
import {
  countByStatus,
  defaultTaskId,
  exportRows,
  filterRows,
  lateBy,
  parseStatusFilter,
  statusLabel,
  type TaskRow,
} from "./dashboard-rules";

const now = new Date("2026-09-07T08:40:00+02:00");

const row = (overrides: Partial<TaskRow>): TaskRow => ({
  learner_id: "l",
  full_name: "Learner",
  learner_number: null,
  status: "outstanding",
  latest_version: null,
  submitted_at: null,
  late_by_seconds: null,
  files_waiting: false,
  last_reminder_at: null,
  ...overrides,
});

const rows = [
  row({ learner_id: "a", full_name: "Sipho Zulu", learner_number: "KSI-2026-0398" }),
  row({
    learner_id: "b",
    full_name: "Lerato Mokoena",
    learner_number: "KSI-2026-0417",
    status: "late",
    latest_version: 2,
    late_by_seconds: 2520,
  }),
  row({ learner_id: "c", full_name: "Ayesha Patel", status: "submitted", latest_version: 1 }),
];

describe("statuses in words", () => {
  it("says overdue for outstanding work after the due time", () => {
    expect(statusLabel("outstanding", "2026-09-04T17:00:00+02:00", now)).toBe("Outstanding (overdue)");
    expect(statusLabel("outstanding", "2026-10-02T17:00:00+02:00", now)).toBe("Outstanding");
    expect(statusLabel("late", null, now)).toBe("Late");
  });

  it("says how late, in the largest sensible unit", () => {
    expect([2520, 3 * 3600, 3 * 86400, null].map(lateBy)).toEqual(["By 42 minutes", "By 3 hours", "By 3 days", null]);
  });
});

describe("the default task (P0-10)", () => {
  it("is the one whose due time is nearest to now, before or after", () => {
    const tasks = [
      { task_id: "t4", due_at: "2026-10-02T17:00:00+02:00" },
      { task_id: "t3", due_at: "2026-09-04T17:00:00+02:00" },
      { task_id: "t2", due_at: "2026-08-14T17:00:00+02:00" },
    ];
    expect(defaultTaskId(tasks, now)).toBe("t3");
    expect(defaultTaskId([], now)).toBeNull();
  });
});

describe("filter and search (FR-211)", () => {
  it("filters by status and searches name or learner number, keeping order", () => {
    expect(filterRows(rows, "outstanding", "").map((r) => r.learner_id)).toEqual(["a"]);
    expect(filterRows(rows, "all", "0417").map((r) => r.learner_id)).toEqual(["b"]);
    expect(filterRows(rows, "all", "  PATEL ").map((r) => r.learner_id)).toEqual(["c"]);
    expect(countByStatus(rows)).toEqual({ all: 3, outstanding: 1, submitted: 1, late: 1 });
    expect(parseStatusFilter("late")).toBe("late");
    expect(parseStatusFilter("marked")).toBe("all");
  });

  it("exports what the table shows, and nothing about outcomes", () => {
    const csv = exportRows(rows, "2026-09-04T17:00:00+02:00", now);
    expect(csv.header).toEqual([
      "learner",
      "learner_number",
      "status",
      "submitted_sast",
      "version",
      "late_by",
      "last_reminder_sast",
    ]);
    expect(csv.rows[0]).toEqual(["Sipho Zulu", "KSI-2026-0398", "Outstanding (overdue)", "", "", "", ""]);
    expect(csv.rows[1][5]).toBe("By 42 minutes");
  });
});

describe("the reminder notification", () => {
  it("carries the facilitator's message and the due date", () => {
    const rendered = renderNotification("task_reminder", 1, {
      title: "Task 3",
      cohort_name: "2026 Intake B",
      due_at: "2020-09-04T15:00:00Z",
      message: "Please hand it in today.",
    });
    expect(rendered.title).toBe("Reminder: Task 3");
    expect(rendered.summary).toBe("Please hand it in today.");
    expect(rendered.paragraphs).toContain("It was due Friday 4 September 2020 at 17:00 (SAST).");
  });
});
