import { formatDateTime, formatDay, sastDatePlusDays } from "@/lib/dates";

/** A step of the cycle's progress, in the shape the Stepper component renders. */
export interface ProgressStep {
  label: string;
  state: "complete" | "current" | "blocked" | "upcoming";
  meta?: string;
}

/**
 * Cycle sign-off (M-04; FR-510, FR-511; P-05, P-06): what blocks a sign-off, who may sign, and what signing does,
 * in words. Pure rules over the row the page reads; the database decides.
 */

export interface Blocker {
  item_id: string;
  seq: number;
  learner_name: string;
  item_title: string;
  assessor_name: string | null;
  moderator_id: string | null;
  moderator_name: string | null;
  state: string;
  returned_at: string | null;
  due_on: string | null;
  overdue: boolean | null;
}

export interface SignOffFacts {
  state: string;
  cohort_name: string;
  population: number;
  competent: number;
  not_yet_competent: number;
  sample: number;
  concluded: number;
  unallocated: number;
  observations: number;
  after_freeze: number;
  blockers: Blocker[];
  may_sign: boolean;
  assessed_by_me: number;
  other_signers: string[];
  appeal_window_days: number;
  signed_off_at: string | null;
  signed_off_by_name: string | null;
  released_count: number | null;
  notified_count: number | null;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The blocker's state, as the sign-off page labels it. */
export function blockerStateLabel(blocker: Pick<Blocker, "state">): string {
  switch (blocker.state) {
    case "returned":
      return "Waiting for assessor";
    case "remarked":
      return "Re-marked. Review again";
    case "unallocated":
      return "Needs a moderator";
    default:
      return "Still to review";
  }
}

/** Who must act next on a blocker: the assessor, this moderator, or another moderator. */
export function blockerActorText(blocker: Blocker, myProfileId: string | null): string {
  if (blocker.state === "returned") return `${blocker.assessor_name ?? "The assessor"}, assessor: must re-mark`;
  if (blocker.state === "unallocated") return "The coordinator: must allocate a moderator";
  const me = blocker.moderator_id !== null && blocker.moderator_id === myProfileId;
  const who = me ? "You" : `${blocker.moderator_name ?? "The moderator"}, moderator`;
  return blocker.state === "remarked" ? `${who}: review the re-mark` : `${who}: record a finding`;
}

/** Why the cycle cannot be signed off yet, one sentence per reason; empty when it is ready. */
export function blockingReasons(facts: SignOffFacts): string[] {
  const reasons: string[] = [];
  const open = facts.blockers.filter((blocker) => blocker.state === "returned" || blocker.state === "remarked").length;
  const unconcluded = facts.sample - facts.concluded;
  if (unconcluded > 0) reasons.push(`${count(unconcluded, "sample item is", "sample items are")} not concluded.`);
  if (open > 0) reasons.push(`${count(open, "returned item is", "returned items are")} still open.`);
  if (facts.unallocated > 0) reasons.push(`${count(facts.unallocated, "item needs", "items need")} a moderator.`);
  return reasons;
}

export function isReady(facts: SignOffFacts): boolean {
  return facts.state === "frozen" && blockingReasons(facts).length === 0;
}

/** The eligibility line (P-05, tightened): the whole population, not only the sampled results. */
export function eligibilityText(facts: SignOffFacts): string {
  const results = count(facts.population, "result", "results");
  if (facts.may_sign) return `You can sign off this cycle: you took no assessment decision on any of its ${results}.`;
  const who =
    facts.other_signers.length === 0
      ? "No other moderator of the cohort can sign off either; the coordinator must assign one who assessed none of them."
      : `${facts.other_signers.join(", ")} can sign off.`;
  return `You cannot sign off this cycle because you assessed ${facts.assessed_by_me} of its ${results}. ${who}`;
}

/** The consequence dialog's sentence (FR-511, BR-04, BR-05). */
export function consequenceText(facts: SignOffFacts, now: Date): string {
  const lastDay = formatDay(sastDatePlusDays(facts.appeal_window_days, now));
  return `Signing off releases ${count(facts.population, "result", "results")} to learners in ${facts.cohort_name} now. Each learner is notified. Each learner's ${facts.appeal_window_days} days to appeal start now and end at the end of ${lastDay}. This cannot be undone.`;
}

/** "Signed off on 22 Sep 2026, 14:05 by Thabo Nkosi. 96 results released. 96 notifications created." */
export function signedOffText(facts: SignOffFacts): string {
  if (!facts.signed_off_at) return "";
  return `Signed off on ${formatDateTime(facts.signed_off_at)} (SAST) by ${facts.signed_off_by_name ?? "a moderator"}. ${count(facts.released_count ?? 0, "result", "results")} released. ${count(facts.notified_count ?? 0, "notification", "notifications")} created.`;
}

/** "11 newer decisions are waiting for the next cycle." (P-06) */
export function afterFreezeText(facts: SignOffFacts): string | null {
  if (facts.after_freeze === 0) return null;
  return `${count(facts.after_freeze, "newer decision is", "newer decisions are")} waiting for the next cycle. ${facts.after_freeze === 1 ? "It was" : "They were"} finalised after the freeze and ${facts.after_freeze === 1 ? "is" : "are"} not released by this sign-off.`;
}

/** The cycle's progress as steps: planned, sampled, in review, re-marks, signed off. */
export function progressSteps(facts: SignOffFacts): ProgressStep[] {
  const open = facts.blockers.filter((blocker) => blocker.state === "returned" || blocker.state === "remarked").length;
  const reviewDone = facts.concluded === facts.sample;
  const signed = facts.state === "signed_off";
  return [
    { label: "Planned", state: "complete" },
    { label: "Sampled", state: "complete", meta: `${facts.sample} of ${facts.population}` },
    {
      label: "In review",
      state: signed || reviewDone ? "complete" : "current",
      meta: `${facts.concluded} of ${facts.sample} concluded`,
    },
    {
      label: open > 0 ? "Waiting for re-marks" : "Re-marks",
      state: signed || reviewDone ? "complete" : open > 0 ? "blocked" : "upcoming",
      meta: open > 0 ? `${open} open` : undefined,
    },
    {
      label: "Signed off",
      state: signed ? "complete" : reviewDone ? "current" : "upcoming",
      meta: signed && facts.signed_off_at ? formatDateTime(facts.signed_off_at) : undefined,
    },
  ];
}

export const SIGN_OFF_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was released.",
  not_found: "This cycle is not one you moderate, or no longer exists.",
  not_frozen: "This cycle is not frozen, so there is nothing to sign off.",
  stale_version:
    "Another moderator changed this cycle while you had it open. Reload to see where it stands; nothing was released.",
  not_eligible:
    "You cannot sign off this cycle: you took an assessment decision on a result in its population (P-05). Nothing was released.",
  blocked: "This cycle cannot be signed off yet: items are still open. They are listed below. Nothing was released.",
  statement_required: "Write the sign-off statement. It is kept with the release.",
  statement_too_long: "The statement is longer than 2,000 characters. Shorten it and try again.",
  error: "The sign-off could not be recorded. Nothing was released. Try again.",
};
