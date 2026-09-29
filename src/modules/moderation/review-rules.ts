import { formatDay } from "@/lib/dates";

/**
 * Moderator review (M-01 to M-03; FR-504, FR-507, FR-508, FR-509; BR-01): the words for a sampled item's state,
 * why it is in the sample, a return's deadline, and what a refusal means. Pure rules over the rows the pages read.
 */

export type ItemState = "unallocated" | "allocated" | "agreed" | "returned" | "remarked";

export const ITEM_STATE_LABELS: Record<string, string> = {
  unallocated: "Waiting for a moderator",
  allocated: "To review",
  agreed: "Agreed",
  returned: "Returned to the assessor",
  remarked: "Re-marked, review again",
};

export function itemStateTone(state: string): "info" | "positive" | "caution" | "neutral" {
  if (state === "agreed") return "positive";
  if (state === "returned") return "caution";
  if (state === "allocated" || state === "remarked") return "info";
  return "neutral";
}

/** An item still to review by this moderator: not yet concluded and not waiting for the assessor. */
export function needsReview(state: string): boolean {
  return state === "allocated" || state === "remarked";
}

/** "Due 17 Sep 2026", "Due today" or "3 days overdue", from a return's deadline (a South African date). */
export function dueText(dueOn: string, now: Date): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(now);
  if (dueOn === today) return "Due today";
  if (dueOn > today) return `Due ${formatDay(dueOn)}`;
  const days = Math.round((Date.parse(today) - Date.parse(dueOn)) / 86_400_000);
  return `${days} ${days === 1 ? "day" : "days"} overdue`;
}

export function isOverdue(dueOn: string, now: Date): boolean {
  return dueOn < new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(now);
}

/** The earliest deadline a moderator may set: tomorrow, as a South African date for a date input. */
export function earliestDueOn(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(
    new Date(now.getTime() + 86_400_000),
  );
}

export const INCLUSION_LABELS: Record<string, string> = {
  nyc: "Mandatory: Not yet competent decision",
  first_time_assessor: "Mandatory: first-time assessor",
  random: "Random within its stratum",
};

/** Why the item is in the sample, in a sentence. */
export function inclusionText(reason: string, stratum: string, assessorName: string | null): string {
  switch (reason) {
    case "nyc":
      return "Every Not yet competent decision in the frozen population is sampled.";
    case "first_time_assessor":
      return `${assessorName ?? "The assessor"} has no decision in an earlier signed-off cycle, so every decision of theirs is sampled.`;
    default:
      return `Drawn at random within the stratum "${stratum}".`;
  }
}

/** "Item 7 of 22". */
export function itemPositionText(seq: number, total: number): string {
  return `Item ${seq} of ${total}`;
}

/** "15 of your 18 items are concluded." */
export function progressText(concluded: number, total: number): string {
  if (total === 0) return "You hold no items in this cycle.";
  if (concluded === total) return `All ${total} of your ${total === 1 ? "item is" : "items are"} concluded.`;
  return `${concluded} of your ${total} ${total === 1 ? "item is" : "items are"} concluded.`;
}

export const FINDING_LABELS: Record<string, string> = { agree: "Agree", disagree: "Disagree" };

export const REVIEW_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  not_found: "This item is not yours to review, or no longer exists.",
  separation_of_duties_conflict:
    "You took an assessment decision on this work, so you cannot moderate it. Nothing was recorded. Ask the coordinator to reallocate it.",
  not_open: "This cycle is signed off, so nothing more can be recorded on it.",
  invalid_finding: "Choose Agree or Disagree.",
  reasons_required: "Give your reasons, in up to 4,000 characters. The assessor and the coordinator can read them.",
  corrections_required: "Say what the assessor must correct, in up to 4,000 characters. They read this.",
  invalid_due_on: "Choose a deadline after today and within ninety days.",
  item_returned: "This item is with the assessor for re-marking. You can review it again once they finalise.",
  cannot_return: "This decision was not made in the marking workspace, so it cannot be returned for re-marking.",
  superseded:
    "The learner handed in a later version, which is being marked afresh. That decision will come to you; nothing was recorded.",
  body_required: "Write the observation, in up to 4,000 characters.",
  concluded: "This item is concluded, so it stays with the moderator who reviewed it.",
  not_a_moderator: "Choose one of the cohort's moderators.",
  unchanged: "That moderator already holds this item.",
  error: "It could not be saved. Try again.",
};

/** What a coordinator's reallocation conflict says: the decision the person took. */
export function conflictText(
  conflict: { actor_name?: string; outcome?: string; decided_at?: string }[] | null,
  formatDateTime: (iso: string) => string,
): string {
  if (!conflict || conflict.length === 0) return "They took an assessment decision on this result.";
  const first = conflict[0];
  const outcome = first.outcome === "not_yet_competent" ? "Not yet competent" : "Competent";
  return `${first.actor_name ?? "They"} decided ${outcome}${first.decided_at ? ` on ${formatDateTime(first.decided_at)} (SAST)` : ""}, so they cannot moderate it (BR-01).`;
}
