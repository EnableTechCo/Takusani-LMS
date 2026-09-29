import { sastDateOf } from "./month";

/**
 * Teaching overview (F-01; FR-210): what needs the facilitator now. Pure rules over their sessions and the
 * submission counts of their tasks, so the page is only layout.
 */

export interface OverviewSession {
  id: string;
  title: string;
  cohort_name: string;
  starts_at: string;
  duration_minutes: number;
  mode: string;
  teams_url: string | null;
  venue: string | null;
  state: string;
  audience: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Sessions on the South African day of `now`, cancelled ones left out, earliest first. */
export function sessionsToday<S extends OverviewSession>(sessions: S[], now: Date): S[] {
  const today = sastDateOf(now.toISOString());
  return sessions
    .filter((session) => session.state !== "cancelled" && sastDateOf(session.starts_at) === today)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** Sessions after today and within the next `days` days, cancelled ones left out, soonest first. */
export function sessionsComingUp<S extends OverviewSession>(sessions: S[], now: Date, days = 7): S[] {
  const today = sastDateOf(now.toISOString());
  const limit = now.getTime() + days * DAY_MS;
  return sessions
    .filter((session) => {
      const starts = new Date(session.starts_at).getTime();
      return session.state !== "cancelled" && sastDateOf(session.starts_at) > today && starts < limit;
    })
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

export interface TaskCounts {
  task_id: string;
  title: string;
  due_at: string | null;
  audience: number;
  submitted: number;
  outstanding: number;
  late: number;
}

export interface OutstandingTask extends TaskCounts {
  cohort_id: string;
  cohort_name: string;
  /** Past its due time with work still outstanding. */
  overdue: boolean;
}

/**
 * Tasks with work still outstanding (FR-210): overdue ones first, then the soonest due; tasks with no due time
 * last. A task everyone has handed in is not listed.
 */
export function outstandingWork(rows: (TaskCounts & { cohort_id: string; cohort_name: string })[], now: Date) {
  const items: OutstandingTask[] = rows
    .filter((row) => row.outstanding > 0)
    .map((row) => ({ ...row, overdue: row.due_at !== null && new Date(row.due_at).getTime() <= now.getTime() }));
  const rank = (item: OutstandingTask) => (item.overdue ? 0 : 1);
  const time = (item: OutstandingTask) => (item.due_at ? new Date(item.due_at).getTime() : Number.POSITIVE_INFINITY);
  return items.sort((a, b) => rank(a) - rank(b) || time(a) - time(b) || a.title.localeCompare(b.title));
}

/** The figures at the top: tasks with outstanding work, learners still to hand in, and late submissions so far. */
export function workSummary(tasks: OutstandingTask[]): { tasks: number; outstanding: number; late: number } {
  return tasks.reduce(
    (total, task) => ({
      tasks: total.tasks + 1,
      outstanding: total.outstanding + task.outstanding,
      late: total.late + task.late,
    }),
    { tasks: 0, outstanding: 0, late: 0 },
  );
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The one-line summary under the title, in words. */
export function teachLead(today: number, tasks: OutstandingTask[]): string {
  const overdue = tasks.filter((task) => task.overdue).length;
  const parts: string[] = [];
  if (today > 0) parts.push(count(today, "session today", "sessions today"));
  if (tasks.length > 0) {
    parts.push(
      `${count(tasks.length, "task", "tasks")} with work outstanding${overdue > 0 ? `, ${overdue} past due` : ""}`,
    );
  }
  if (parts.length === 0) return "No sessions today, and every task set has been handed in.";
  const sentence = parts.join(", and ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
