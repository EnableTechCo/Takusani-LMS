import { z } from "zod";

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
