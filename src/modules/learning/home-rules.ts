import { appealWindow } from "@/modules/assessment/rules";

/**
 * Learner home (L-01, P0-03): "what needs me now?" in one screen. Pure rules over the learner's own tasks and
 * results, so the page is only layout. Block order (P0-03): new results, do next, being assessed. Sessions, the exam
 * window and credit progress join when those features exist.
 */

export interface HomeTask {
  id: string;
  title: string;
  cohort_name: string;
  due_at: string | null;
  late_policy: string;
  latest_version: number | null;
  latest_submitted_at: string | null;
}

export interface HomeResult {
  result_id: string;
  task_id: string;
  item_title: string;
  state: string;
  outcome: string | null;
  released_at: string | null;
  appeal_deadline_at: string | null;
  remediation_deadline_at: string | null;
}

const before = (a: string | null, b: Date) => a !== null && new Date(a).getTime() <= b.getTime();

/** A task past its due time that takes no late work cannot be handed in online. */
export function isClosed(task: HomeTask, now: Date): boolean {
  return task.late_policy === "closed_at_due" && before(task.due_at, now);
}

/** A later version handed in after the release is being assessed; the released result stands until it is decided. */
function resubmittedSince(result: HomeResult, task: HomeTask | undefined): boolean {
  return (
    !!task?.latest_submitted_at &&
    !!result.released_at &&
    new Date(task.latest_submitted_at).getTime() > new Date(result.released_at).getTime()
  );
}

/** A "not yet competent" result whose resubmission time is still running and that has not been resubmitted. */
function resubmissionOpen(result: HomeResult, task: HomeTask | undefined, now: Date): boolean {
  return (
    result.state === "released" &&
    result.outcome === "not_yet_competent" &&
    !!result.remediation_deadline_at &&
    !before(result.remediation_deadline_at, now) &&
    !resubmittedSince(result, task)
  );
}

export interface NewResult {
  result: HomeResult;
  appealOpen: boolean;
  resubmitUntil: string | null;
}

/** New results: released, while an appeal window or a resubmission period is open (P0-03 block 1). Newest first. */
export function newResults(results: HomeResult[], tasks: HomeTask[], now: Date): NewResult[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return results
    .filter((result) => result.state === "released" && result.released_at && result.appeal_deadline_at)
    .map((result) => {
      const resubmit = resubmissionOpen(result, taskById.get(result.task_id), now);
      return {
        result,
        appealOpen: appealWindow(result.appeal_deadline_at!, now).state !== "closed",
        resubmitUntil: resubmit ? result.remediation_deadline_at : null,
      };
    })
    .filter((item) => item.appealOpen || item.resubmitUntil)
    .sort((a, b) => new Date(b.result.released_at!).getTime() - new Date(a.result.released_at!).getTime());
}

export type DoNextStatus = "not_started" | "overdue" | "resubmission_open";

export interface DoNextItem {
  taskId: string;
  title: string;
  cohortName: string;
  status: DoNextStatus;
  /** Due time, or for a resubmission the time the resubmission period ends. Null for a task with no due date. */
  deadline: string | null;
  /** Where the row's action goes. */
  href: string;
}

/**
 * Do next (P0-03 block 2): tasks not handed in yet that can still be handed in, and resubmissions still open.
 * Overdue first, then soonest deadline; work with no deadline last.
 */
export function doNext(tasks: HomeTask[], results: HomeResult[], now: Date): DoNextItem[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const items: DoNextItem[] = [];

  for (const task of tasks) {
    if (task.latest_version !== null || isClosed(task, now)) continue;
    items.push({
      taskId: task.id,
      title: task.title,
      cohortName: task.cohort_name,
      status: before(task.due_at, now) ? "overdue" : "not_started",
      deadline: task.due_at,
      href: `/learn/tasks/${task.id}`,
    });
  }
  for (const result of results) {
    const task = taskById.get(result.task_id);
    if (!task || !resubmissionOpen(result, task, now)) continue;
    items.push({
      taskId: task.id,
      title: task.title,
      cohortName: task.cohort_name,
      status: "resubmission_open",
      deadline: result.remediation_deadline_at,
      href: `/learn/results/${result.result_id}`,
    });
  }

  const rank = (item: DoNextItem) => (item.status === "overdue" ? 0 : 1);
  const time = (item: DoNextItem) => (item.deadline ? new Date(item.deadline).getTime() : Number.POSITIVE_INFINITY);
  return items.sort((a, b) => rank(a) - rank(b) || time(a) - time(b) || a.title.localeCompare(b.title));
}

export interface AssessedItem {
  resultId: string;
  title: string;
  version: number | null;
  submittedAt: string | null;
}

/**
 * Being assessed (P0-03 block 4): work handed in with no result yet (held, which includes "decided and waiting for
 * moderation"), and resubmissions handed in after a released result. No outcome or date that hints at one.
 */
export function beingAssessed(tasks: HomeTask[], results: HomeResult[]): AssessedItem[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  return results
    .filter((result) => result.state === "held" || resubmittedSince(result, taskById.get(result.task_id)))
    .map((result) => {
      const task = taskById.get(result.task_id);
      return {
        resultId: result.result_id,
        title: result.item_title,
        version: task?.latest_version ?? null,
        submittedAt: task?.latest_submitted_at ?? null,
      };
    })
    .sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
}

/** "Good morning", "Good afternoon" or "Good evening", by the time in South Africa. */
export function greeting(now: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", hourCycle: "h23", timeZone: "Africa/Johannesburg" }).format(
      now,
    ),
  );
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** The one-line summary under the greeting: what is new and what needs doing, in words. */
export function summaryLine(fresh: NewResult[], todo: DoNextItem[]): string {
  const parts: string[] = [];
  if (fresh.length === 1) parts.push(`Your result for ${fresh[0].result.item_title} is ready`);
  else if (fresh.length > 1) parts.push(`${fresh.length} new results are ready`);
  if (todo.length === 1) parts.push("one piece of work needs your attention");
  else if (todo.length > 1) parts.push(`${todo.length} pieces of work need your attention`);
  if (parts.length === 0) return "Nothing needs you right now. New work and results will show here.";
  const sentence = parts.join(", and ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
