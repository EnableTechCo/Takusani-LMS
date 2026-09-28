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
export const COORDINATOR_STATE_LABELS: Record<AppealState, string> = {
  lodged: "Needs your check",
  admitted: "Accepted",
  inadmissible: "Not accepted",
  allocated: "With a reviewer",
  under_review: "Being reviewed",
  concluded: "Decided",
};

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
export function learnerSteps(appeal: { type: AppealType; state: AppealState; lodgedAt: string }): AppealStep[] {
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
    return [received, { ...checking, state: "complete" }, { label: "Not accepted", state: "complete" }];
  }

  const rest: Omit<AppealStep, "state">[] =
    appeal.type === "remark"
      ? [
          checking,
          { label: "Accepted" },
          { label: "With a reviewer", body: "A reviewer who did not mark your work is chosen." },
          { label: "Being reviewed", body: "The reviewer marks your work again." },
          { label: "Decided", body: "The decision is final. The mark can stay the same, go up or go down." },
        ]
      : [
          checking,
          {
            label: "Accepted: see your marked work",
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
    })),
  ];
}
