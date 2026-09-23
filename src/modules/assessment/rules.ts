import { z } from "zod";
import { lastFullDayBefore, sastDaysFromToday } from "@/lib/dates";

/** Marking (FR-403 to FR-405): the shape of a draft, and what each refusal from the database means. */

export const OUTCOME_LABELS: Record<string, string> = {
  competent: "Competent",
  not_yet_competent: "Not yet competent",
};

export const INSTANCE_STATE_LABELS: Record<string, string> = {
  to_mark: "To mark",
  marking: "Marking",
  decided: "Decided",
  superseded: "Replaced by a later version",
};

export interface Score {
  ordinal: number;
  points: number | null;
  comment: string;
}

export interface Draft {
  scores: Score[];
  feedback: string;
  outcome: "competent" | "not_yet_competent" | null;
  justification: string;
  remediation: string;
  resubmissionDays: number | null;
}

export const draftSchema = z.object({
  scores: z.array(
    z.object({
      ordinal: z.number().int().min(1),
      points: z.number().int().min(0).nullable(),
      comment: z.string().max(2000),
    }),
  ),
  feedback: z.string().max(10000),
  outcome: z.enum(["competent", "not_yet_competent"]).nullable(),
  justification: z.string().max(5000),
  remediation: z.string().max(5000),
  resubmissionDays: z.number().int().min(1).max(90).nullable(),
});

/**
 * What a draft still needs before it can be finalised (FR-404, FR-405): an outcome, a justification, and for "not
 * yet competent" the remediation and the resubmission period. Said in words, for the text beside the button.
 */
export function missingForFinalise(draft: Draft): string[] {
  const missing: string[] = [];
  if (!draft.outcome) missing.push("the outcome");
  if (!draft.justification.trim()) missing.push("the justification");
  if (draft.outcome === "not_yet_competent") {
    if (!draft.remediation.trim()) missing.push("what the learner must do");
    if (!draft.resubmissionDays) missing.push("the resubmission period");
  }
  return missing;
}

/** The running total where the rubric carries points, for example "14 of 20". Null when no row has points. */
export function runningTotal(
  criteria: { ordinal: number; points: number | null }[],
  scores: Score[],
): { scored: number; possible: number } | null {
  const withPoints = criteria.filter((criterion) => criterion.points !== null);
  if (withPoints.length === 0) return null;
  return {
    scored: scores.reduce((sum, score) => sum + (score.points ?? 0), 0),
    possible: withPoints.reduce((sum, criterion) => sum + (criterion.points ?? 0), 0),
  };
}

export const MARKING_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; your last saved draft is kept.",
  not_found: "This item is not in your marking scope.",
  not_your_item: "Someone else is marking this item, so your changes were not saved.",
  allocated_to_someone_else: "Someone else is already marking this item.",
  not_open_for_marking: "This item is no longer open for marking.",
  stale_version:
    "This draft was changed in another tab or window. Reload to see the latest; what you typed here was not saved.",
  invalid_points: "A score is more than the criterion is worth. Check the marks.",
  invalid_outcome: "Choose Competent or Not yet competent.",
  invalid_resubmission_days: "The resubmission period is between 1 and 90 days.",
  invalid_scores: "The marks could not be read. Try again.",
  error: "The draft could not be saved. Your changes are still on this page; try again.",
};

export const FINALISE_REFUSALS: Record<string, string> = {
  ...MARKING_REFUSALS,
  stale_version:
    "The draft changed after this page last saved it. Reload to see the latest before finalising; nothing was decided.",
  moderated_resubmission_not_yet_supported:
    "This cohort is moderated and this result was already released. Deciding it again waits for moderation of resubmissions, which is not available yet. Nothing was decided.",
  not_found: "This item is not in your marking scope.",
};

/** What `incomplete` names, in the words the page uses. */
export const FINALISE_MISSING: Record<string, string> = {
  outcome: "the outcome",
  justification: "the justification",
  remediation: "what the learner must do",
  resubmission_days: "the resubmission period",
};

/**
 * Where the learner's appeal window stands (SRS 5.3, P-11, FR-603). The deadline is exclusive: the start of the
 * eighth South African day after release, shown as the last full day before it. `daysLeft` counts whole days after
 * today up to that last day, so on the last day it is 0.
 */
export type AppealWindow =
  | { state: "open"; lastDay: string; daysLeft: number }
  | { state: "last_day"; lastDay: string }
  | { state: "closed"; lastDay: string };

export function appealWindow(appealDeadlineAt: string, now: Date): AppealWindow {
  const lastDay = lastFullDayBefore(appealDeadlineAt, "long");
  if (now.getTime() >= new Date(appealDeadlineAt).getTime()) return { state: "closed", lastDay };
  const lastSecond = new Date(new Date(appealDeadlineAt).getTime() - 1000).toISOString();
  const daysLeft = sastDaysFromToday(lastSecond, now);
  return daysLeft <= 0 ? { state: "last_day", lastDay } : { state: "open", lastDay, daysLeft };
}

/**
 * What a "not yet competent" learner can do about resubmitting (FR-317). The deadline is the instant the assessor's
 * period ends, counted from release (CR-14).
 *   * waiting: a later version is already handed in and being assessed.
 *   * open: they can hand in a new version now.
 *   * task_closed: the deadline has not passed, but the task takes no new versions online.
 *   * ended: the deadline has passed.
 */
export type Resubmission = "waiting" | "open" | "task_closed" | "ended";

export function resubmission({
  deadlineAt,
  taskClosed,
  assessedVersion,
  latestVersion,
  now,
}: {
  deadlineAt: string;
  taskClosed: boolean;
  assessedVersion: number;
  latestVersion: number;
  now: Date;
}): Resubmission {
  if (latestVersion > assessedVersion) return "waiting";
  if (now.getTime() >= new Date(deadlineAt).getTime()) return "ended";
  return taskClosed ? "task_closed" : "open";
}
