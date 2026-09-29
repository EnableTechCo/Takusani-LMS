import { lastFullDayBefore } from "@/lib/dates";

/**
 * Cohort archival (X-10; FR-111, FR-112): what still blocks archiving a cohort, in the words the screen shows, and the
 * refusals. The database checks it all again under the cohort's lock.
 */

export interface ArchivalBlockers {
  open_cycles: number;
  not_assessed: number;
  held: number;
  pending: number;
  resubmissions: number;
  appeal_window_until: string | null;
  open_appeals: number;
  open_corrections: number;
}

const counted = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "3 results are still held." / "Appeal windows are open until the end of Tuesday 29 September 2026." */
export function blockerLines(blockers: ArchivalBlockers): string[] {
  const lines: string[] = [];
  if (blockers.open_cycles > 0)
    lines.push(
      `${counted(blockers.open_cycles, "moderation cycle is", "moderation cycles are")} not signed off or cancelled.`,
    );
  if (blockers.not_assessed > 0)
    lines.push(
      `${counted(blockers.not_assessed, "piece of work has", "pieces of work have")} been handed in and not assessed.`,
    );
  if (blockers.held > 0) lines.push(`${counted(blockers.held, "result is", "results are")} still held.`);
  if (blockers.pending > 0)
    lines.push(`${counted(blockers.pending, "later decision is", "later decisions are")} waiting for moderation.`);
  if (blockers.resubmissions > 0)
    lines.push(`${counted(blockers.resubmissions, "resubmission is", "resubmissions are")} waiting to be marked.`);
  if (blockers.appeal_window_until)
    lines.push(`Appeal windows are open until the end of ${lastFullDayBefore(blockers.appeal_window_until, "long")}.`);
  if (blockers.open_appeals > 0)
    lines.push(`${counted(blockers.open_appeals, "appeal is", "appeals are")} not concluded.`);
  if (blockers.open_corrections > 0)
    lines.push(`${counted(blockers.open_corrections, "correction is", "corrections are")} waiting for approval.`);
  return lines;
}

export const ARCHIVE_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was changed.",
  forbidden: "Only an administrator can archive a cohort.",
  not_found: "That cohort does not exist.",
  already_archived: "This cohort is already archived.",
  not_active: "A cohort still being set up cannot be archived.",
  blocked: "The cohort was not archived: something about it is still open.",
  error: "The cohort could not be archived. Try again.",
};

/** What archiving does, for the consequence dialog. */
export function archiveConsequence(cohortName: string, learners: number): string {
  return `${cohortName} becomes read-only for everyone: no work, result, decision, session or enrolment can change, and it cannot be undone here. Its records, including ${counted(learners, "learner's", "learners'")} results and credits, stay available to reports and the Department record for the retention period.`;
}
