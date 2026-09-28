/**
 * Appeals (S3-01; FR-601 to FR-604, FR-612, FR-613): the words for each kind and state, the grounds rule, and what
 * each refusal from the database means. The database decides; these only say it.
 */

export type AppealType = "view_script" | "remark";

export type AppealState = "lodged" | "admitted" | "inadmissible" | "allocated" | "under_review" | "concluded";

export const GROUNDS_MIN = 50;
export const GROUNDS_MAX = 2000;

/** What the learner asked for, as a short phrase: "You asked for: a re-mark". */
export const APPEAL_TYPE_LABELS: Record<AppealType, string> = {
  view_script: "To see your work with the marks",
  remark: "A re-mark",
};

/** The kind, as staff read it in a list. */
export const APPEAL_TYPE_STAFF_LABELS: Record<AppealType, string> = {
  view_script: "See the marked work",
  remark: "Re-mark",
};

/** Where the appeal stands, in the learner's words (UX flow E, step 8). */
export const LEARNER_STATE_LABELS: Record<AppealState, string> = {
  lodged: "Being checked",
  admitted: "Accepted",
  inadmissible: "Not accepted",
  allocated: "With a reviewer",
  under_review: "Being reviewed",
  concluded: "Decided",
};

/** Where the appeal stands, in the coordinator's words: what it needs from them first. */
export function coordinatorStateLabel(type: string, state: string): string {
  if (state === "lodged") return "Needs your check";
  if (state === "admitted") return type === "remark" ? "Needs a reviewer" : "View granted";
  const labels: Record<string, string> = {
    inadmissible: "Not accepted",
    allocated: "With a reviewer",
    under_review: "Being reviewed",
    concluded: "Decided",
  };
  return labels[state] ?? state;
}

/** The coordinator acts on it next: a check, or a reviewer for an accepted re-mark. */
export function needsCoordinator(type: string, state: string): boolean {
  return state === "lodged" || (state === "admitted" && type === "remark");
}

export function isOpen(state: string): boolean {
  return state !== "inadmissible" && state !== "concluded";
}

/** The same rule the database applies (FR-602): required, at least 50 and at most 2000 characters. */
export function groundsError(grounds: string): string | null {
  const length = grounds.trim().length;
  if (length === 0) return APPEAL_REFUSALS.grounds_required;
  if (length < GROUNDS_MIN) return APPEAL_REFUSALS.grounds_too_short;
  if (length > GROUNDS_MAX) return APPEAL_REFUSALS.grounds_too_long;
  return null;
}

/** "0 / 2000 characters", then how many more are needed while there are too few. */
export function groundsCount(grounds: string): string {
  const length = grounds.trim().length;
  const count = `${length} / ${GROUNDS_MAX} characters`;
  if (length > 0 && length < GROUNDS_MIN) return `${count}. ${GROUNDS_MIN - length} more needed`;
  return count;
}

export const APPEAL_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; copy your reasons first so you do not lose them.",
  not_found: "This result is not one of yours.",
  not_released: "This result is still being assessed. You can appeal once it is released.",
  window_closed: "The time to appeal this result has closed, so the appeal was not lodged.",
  decision_final: "This result was decided on appeal. That decision is final; there is no further appeal.",
  invalid_type: "Choose what you are asking for.",
  grounds_required: "Enter your reasons. We cannot review an appeal without them.",
  grounds_too_short: `Write at least ${GROUNDS_MIN} characters, so the person checking knows what to look at.`,
  grounds_too_long: `Your reasons are longer than ${GROUNDS_MAX} characters. Shorten them and try again.`,
  already_open: "You already have an open appeal of this kind for this result, so a second one was not lodged.",
  remark_used: "A re-mark has already been done for this result. Only one re-mark is allowed.",
  rate_limited: "You have lodged 10 appeals today, which is the most allowed in a day. Try again tomorrow.",
  error: "The appeal could not be lodged. Your reasons are still on this page; try again.",
};

export const ADMISSIBILITY_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was recorded.",
  not_found: "This appeal is not in a cohort you coordinate.",
  already_decided: "This appeal has already been checked, so nothing was changed. The page now shows the decision.",
  reason_required:
    "Enter a reason. An appeal cannot be recorded as inadmissible without one, because the learner must be told why.",
  reason_too_long: "The reason is longer than 1000 characters. Shorten it and try again.",
  remark_used: "A re-mark of this result has already been accepted. Only one re-mark is allowed for each result.",
  error: "The decision could not be recorded. Try again.",
};

export const ALLOCATION_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was allocated.",
  not_found: "This appeal is not in a cohort you coordinate.",
  not_a_remark: "Only a re-mark has a reviewer.",
  not_admitted: "Accept the appeal before choosing a reviewer.",
  closed: "This appeal is closed, so its reviewer cannot be changed.",
  not_eligible:
    "This person does not hold an assessor or moderator role, so they cannot review appeals. Nothing was allocated.",
  already_allocated: "This person is already the reviewer. Nothing was changed.",
  skip_reason_required: "Someone is available in an earlier group. Say why you are passing over them.",
  invalid_reviewer: "Choose a reviewer.",
  error: "The reviewer could not be allocated. Try again.",
};

/** AS-02, in the order the appeals policy sets (P-10). */
export const TIER_LABELS: Record<number, string> = {
  1: "Tier 1: independent qualified internal reviewers",
  2: "Tier 2: cohort moderator",
  3: "Tier 3: qualified assessors from other cohorts",
};

/** What each tier means, said once under the reviewer's name once allocated. */
export const TIER_DESCRIPTIONS: Record<number, string> = {
  1: "tier 1, an assessor for this cohort who took no assessment decision on this work",
  2: "tier 2, the cohort moderator, who took no assessment decision on this work",
  3: "tier 3, an assessor from another cohort, given access to this appeal only",
};

export interface ExcludingDecision {
  decision_id: string;
  decided_at: string;
  outcome: string;
  version_number: number | null;
}

/** "your coordinator, Ayesha Patel", "your coordinators, Ayesha Patel and Zanele Khumalo", or "your coordinator". */
export function coordinatorsText(names: string[]): string {
  if (names.length === 0) return "your coordinator";
  if (names.length === 1) return `your coordinator, ${names[0]}`;
  return `your coordinators, ${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A working-day promise, labelled as one (UX writing rules). */
export function turnaroundText(days: number): string {
  return days === 1 ? "within 1 working day" : `within ${days} working days`;
}

/** "5 of 8" where the rubric carries points. */
export function pointsText(scored: number | null, possible: number | null): string | null {
  return scored === null || possible === null ? null : `${scored} of ${possible}`;
}

export type StepState = "complete" | "current" | "upcoming";

export interface AppealStep {
  label: string;
  state: StepState;
  at?: string;
  body?: string;
}

/**
 * The learner's timeline (FR-612, UX flow E step 8): Received, Being checked, Accepted (or Not accepted), then for a
 * re-mark With a reviewer, Being reviewed and Decided. Each step is done, current or still to come, never told by
 * colour alone.
 */
export function learnerSteps(appeal: {
  type: AppealType;
  state: AppealState;
  lodgedAt: string;
  /** When the coordinator decided admissibility, and when a reviewer was first allocated. */
  checkedAt?: string | null;
  allocatedAt?: string | null;
  reviewOpenedAt?: string | null;
  concludedAt?: string | null;
}): AppealStep[] {
  const received: AppealStep = {
    label: "Received",
    state: "complete",
    at: appeal.lodgedAt,
    body: appeal.type === "remark" ? "You asked for a re-mark." : "You asked to see your work with the marks.",
  };
  const checking = {
    label: "Being checked",
    body: "Your coordinator checks that the appeal is in time and gives reasons. If it is not accepted, you will be told why.",
  };
  if (appeal.state === "inadmissible") {
    return [
      received,
      { ...checking, state: "complete" },
      { label: "Not accepted", state: "complete", at: appeal.checkedAt ?? undefined },
    ];
  }

  const rest: Omit<AppealStep, "state">[] =
    appeal.type === "remark"
      ? [
          checking,
          { label: "Accepted", at: appeal.checkedAt ?? undefined },
          {
            label: "With a reviewer",
            body: "A reviewer who did not mark your work is chosen.",
            at: appeal.allocatedAt ?? undefined,
          },
          {
            label: "Being reviewed",
            body: "The reviewer marks your work again.",
            at: appeal.reviewOpenedAt ?? undefined,
          },
          {
            label: "Decided",
            body: "The decision is final. The mark can stay the same, go up or go down.",
            at: appeal.concludedAt ?? undefined,
          },
        ]
      : [
          checking,
          {
            label: "Accepted: see your marked work",
            at: appeal.checkedAt ?? undefined,
            body: "You can see your work next to the marks for each criterion and the assessor's feedback.",
          },
        ];
  // How many steps after "Received" are done.
  const done: Record<AppealState, number> =
    appeal.type === "remark"
      ? { lodged: 0, admitted: 2, allocated: 3, under_review: 3, concluded: 5, inadmissible: 2 }
      : { lodged: 0, admitted: 2, allocated: 2, under_review: 2, concluded: 2, inadmissible: 2 };
  const complete = done[appeal.state];
  return [
    received,
    ...rest.map((step, index): AppealStep => ({
      ...step,
      state: index < complete ? "complete" : index === complete ? "current" : "upcoming",
      // A time belongs to a step that has happened.
      at: index < complete ? step.at : undefined,
    })),
  ];
}

export type OutcomeCategory = "upheld" | "amended_up" | "amended_down";

/** The reviewer's outcome, in the learner's words (UX flow E, step 9). */
export const CATEGORY_LEARNER_LABELS: Record<OutcomeCategory, string> = {
  upheld: "Mark upheld",
  amended_up: "Mark changed: higher",
  amended_down: "Mark changed: lower",
};

/** The same, as staff read it. */
export const CATEGORY_STAFF_LABELS: Record<OutcomeCategory, string> = {
  upheld: "Upheld",
  amended_up: "Amended upward",
  amended_down: "Amended downward",
};

/**
 * The database's rule (appeals.outcome_category), for the live preview while the reviewer marks: the outcome first,
 * then the total. The database decides again when the conclusion is recorded.
 */
export function outcomeCategory(
  oldOutcome: string,
  oldTotal: number | null,
  newOutcome: string,
  newTotal: number | null,
): OutcomeCategory {
  if (oldOutcome !== newOutcome) return newOutcome === "competent" ? "amended_up" : "amended_down";
  if (oldTotal !== newTotal) return (newTotal ?? 0) > (oldTotal ?? 0) ? "amended_up" : "amended_down";
  return "upheld";
}

export const CONCLUDE_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was recorded. Copy your reasons first.",
  not_found: "This appeal is not allocated to you, so nothing was recorded.",
  already_concluded: "This appeal has already been decided. Nothing was changed.",
  not_open: "This appeal is not open for review.",
  separation_of_duties_conflict:
    "You took an assessment decision on this work, so you cannot decide this appeal. Nothing was recorded. Tell the coordinator, who will reallocate it.",
  result_changed:
    "This result has had a new decision since the appeal was lodged. Nothing was recorded. Ask the coordinator what to do.",
  invalid_outcome: "Choose Competent or Not yet competent.",
  reasons_required: "Enter your reasons. The learner reads them, and the decision cannot be recorded without them.",
  reasons_too_long: "Your reasons are longer than 5000 characters. Shorten them and try again.",
  invalid_scores: "The marks could not be read. Reload the page and try again.",
  invalid_points: "A mark is more than the criterion is worth. Check the marks.",
  remediation_required: "Say what the learner must do. A not yet competent decision always carries it.",
  resubmission_days_required: "Choose a resubmission period between 1 and 90 days.",
  error: "The decision could not be recorded. Your marks and reasons are still on this page; try again.",
};
