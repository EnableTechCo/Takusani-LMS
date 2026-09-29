/** Session logistics (C-11; FR-705 to FR-707): the words for the headcount, the variance and refusals. */

/** Where the default headcount came from (FR-706), in words. */
export function defaultHeadcountText(headcount: number, source: string, basis: number): string {
  if (source === "expected_attendance") {
    return `${headcount}: the average present at the cohort's last ${basis === 1 ? "session" : `${basis} sessions`} with a register`;
  }
  return `${headcount}: the learners enrolled`;
}

export const HEADCOUNT_SOURCE_LABELS: Record<string, string> = {
  enrolment: "from enrolment",
  expected_attendance: "from attendance so far",
  manual: "set by a coordinator",
};

/** "3 of 3 arranged", with whether everything is. */
export function arrangedText(arranged: number, needed: number): { text: string; all: boolean } {
  return { text: `${arranged} of ${needed} arranged`, all: arranged >= needed };
}

/** The difference between the learners present and the confirmed headcount (FR-707), in words. */
export function varianceText(present: number, headcount: number): string {
  const difference = present - headcount;
  if (difference === 0) return `${present} present, as confirmed`;
  const people = Math.abs(difference) === 1 ? "person" : "people";
  return `${present} present against ${headcount} confirmed: ${Math.abs(difference)} ${people} ${difference > 0 ? "more" : "fewer"}`;
}

export const LOGISTICS_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  not_found: "This session is not in a cohort you coordinate.",
  not_in_person: "This session is online, so it has no venue, catering or equipment to arrange.",
  cancelled: "This session was cancelled, so its logistics cannot change.",
  too_long: "Keep each note to 1,000 characters.",
  invalid_headcount: "Give the catering headcount as a number of people.",
  equipment_required: "Say what equipment is needed before marking it arranged.",
  stale_version:
    "Someone else saved this session's logistics while you had it open. Nothing was saved: check it below.",
  nothing_to_reconcile: "There is no flagged difference to reconcile.",
  note_required: "Say what happened, in up to 1,000 characters. It is kept with the session.",
  error: "It could not be saved. Try again.",
};
