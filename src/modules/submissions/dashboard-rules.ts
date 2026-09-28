import { formatDateTime } from "@/lib/dates";

/**
 * The facilitator's submission dashboard (S2-16; FR-210 to FR-212, P0-10): statuses in words, the default task, the
 * filter and search, and the export. Operational status only: no outcome or mark ever passes through here.
 */

export type SubmissionStatus = "outstanding" | "submitted" | "late";
export const STATUS_FILTERS = ["all", "outstanding", "submitted", "late"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  outstanding: "Outstanding",
  submitted: "Submitted",
  late: "Late",
};

export function parseStatusFilter(value: string | undefined): StatusFilter {
  return (STATUS_FILTERS as readonly string[]).includes(value ?? "") ? (value as StatusFilter) : "all";
}

export interface TaskRow {
  learner_id: string;
  full_name: string;
  learner_number: string | null;
  status: string;
  latest_version: number | null;
  submitted_at: string | null;
  late_by_seconds: number | null;
  files_waiting: boolean;
  last_reminder_at: string | null;
}

/** "Outstanding (overdue)" after the due time; "Late" and "Submitted" as they are. Text first (design system 3). */
export function statusLabel(status: string, dueAt: string | null, now: Date): string {
  if (status === "outstanding") {
    return dueAt && new Date(dueAt).getTime() <= now.getTime() ? "Outstanding (overdue)" : "Outstanding";
  }
  return status === "late" ? "Late" : "Submitted";
}

/** "By 42 minutes", "By 3 hours", "By 2 days". */
export function lateBy(seconds: number | null): string | null {
  if (seconds === null || seconds <= 0) return null;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `By ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `By ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `By ${days} days`;
}

/**
 * The task the dashboard opens on: the one whose due time is nearest to now, before or after, so the page answers
 * "who has not submitted" without a click (P0-10, default view).
 */
export function defaultTaskId(tasks: { task_id: string; due_at: string | null }[], now: Date): string | null {
  const dated = tasks.filter((task) => task.due_at);
  if (dated.length === 0) return tasks[0]?.task_id ?? null;
  return dated.reduce((best, task) =>
    Math.abs(new Date(task.due_at!).getTime() - now.getTime()) <
    Math.abs(new Date(best.due_at!).getTime() - now.getTime())
      ? task
      : best,
  ).task_id;
}

/** The rows shown for a status filter and a search over name and learner number, keeping the database's order. */
export function filterRows<T extends TaskRow>(rows: T[], status: StatusFilter, search: string): T[] {
  const words = search.trim().toLowerCase();
  return rows.filter(
    (row) =>
      (status === "all" || row.status === status) &&
      (!words || `${row.full_name} ${row.learner_number ?? ""}`.toLowerCase().includes(words)),
  );
}

export function countByStatus(rows: TaskRow[]): Record<StatusFilter, number> {
  return {
    all: rows.length,
    outstanding: rows.filter((row) => row.status === "outstanding").length,
    submitted: rows.filter((row) => row.status === "submitted").length,
    late: rows.filter((row) => row.status === "late").length,
  };
}

/** The export (FR-211): what the table shows, as columns a spreadsheet can sort. */
export function exportRows(rows: TaskRow[], dueAt: string | null, now: Date): { header: string[]; rows: string[][] } {
  return {
    header: ["learner", "learner_number", "status", "submitted_sast", "version", "late_by", "last_reminder_sast"],
    rows: rows.map((row) => [
      row.full_name,
      row.learner_number ?? "",
      statusLabel(row.status, dueAt, now),
      row.submitted_at ? formatDateTime(row.submitted_at) : "",
      row.latest_version === null ? "" : String(row.latest_version),
      lateBy(row.late_by_seconds) ?? "",
      row.last_reminder_at ? formatDateTime(row.last_reminder_at) : "",
    ]),
  };
}

export const REMINDER_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again.",
  forbidden: "You do not set work in this cohort.",
  task_not_found: "This task is not published.",
  invalid_message: "Write the reminder, up to 1,000 characters.",
  no_learners: "Choose at least one learner who has not handed in.",
  too_many: "Send to at most 2,000 learners at a time.",
  error: "The reminder could not be sent. Try again.",
};
