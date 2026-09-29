/**
 * Administrative correction under dual control (C-14; P-12; BR-03): a correction's state, why a result cannot be
 * corrected, why someone cannot approve, and the refusals, in words. The database decides.
 */

export type CorrectionState = "proposed" | "approved" | "declined" | "withdrawn";

export const CORRECTION_STATE_LABELS: Record<string, string> = {
  proposed: "Waiting for approval",
  approved: "Approved and released",
  declined: "Declined",
  withdrawn: "Withdrawn",
};

export function correctionTone(state: string): "info" | "positive" | "neutral" | "caution" {
  if (state === "proposed") return "caution";
  if (state === "approved") return "positive";
  return "neutral";
}

/** Why a released result cannot be corrected now. */
export const BLOCKER_TEXT: Record<string, string> = {
  not_released: "Not released: a held result goes through moderation.",
  pending_moderation: "A later decision is waiting for moderation; correct it after the cycle is signed off.",
  appeal_final: "Decided on appeal: the decision is final (FR-613).",
};

/** Why this person cannot approve or decline the correction in front of them. */
export const CANNOT_CONCLUDE_TEXT: Record<string, string> = {
  concluded: "This correction is concluded.",
  own_proposal:
    "You proposed this correction, so a second person must approve it: another coordinator of the cohort or an administrator.",
  took_a_decision: "You took a decision on this result, so you cannot approve or decline a correction of it.",
  result_changed:
    "The result changed after this correction was proposed: a later decision now stands. Decline it with that reason, and propose again if a correction is still needed.",
};

export const CORRECTION_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  not_found: "This result or correction is not in a cohort you coordinate.",
  took_a_decision: "You took a decision on this result, so you cannot propose or approve a correction of it.",
  not_released: BLOCKER_TEXT.not_released,
  pending_moderation: BLOCKER_TEXT.pending_moderation,
  appeal_final: BLOCKER_TEXT.appeal_final,
  already_proposed: "A correction of this result is already waiting for approval.",
  invalid_outcome: "Choose the outcome that should stand.",
  unchanged: "That is the outcome already released. A correction changes the outcome.",
  justification_required:
    "Write the justification for the corrected outcome, against the criteria. The learner reads it.",
  justification_too_long: "The justification is longer than 5,000 characters.",
  reason_required: "Say why the released outcome was wrong. It is kept with the correction.",
  reason_too_long: "The reason is longer than 2,000 characters.",
  remediation_required: "Say what the learner must do to reach competence.",
  resubmission_days_required: "Give the resubmission period, between 1 and 90 days from release.",
  not_open: "This correction is already concluded.",
  same_person: CANNOT_CONCLUDE_TEXT.own_proposal,
  result_changed: CANNOT_CONCLUDE_TEXT.result_changed,
  error: "It could not be saved. Try again.",
};

/** The consequence of approving, in one sentence (principle 5). */
export function approveConsequence(learnerName: string, outcomeLabel: string, appealWindowDays: number): string {
  return `This releases ${outcomeLabel} to ${learnerName} now, replacing the released outcome, which stays on record. ${learnerName} is told the result was corrected, and has ${appealWindowDays} days from today to appeal it. This cannot be undone.`;
}
