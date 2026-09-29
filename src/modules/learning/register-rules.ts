/**
 * The attendance register (S3-12; FR-209, CR-03): marks and amendments in words, and the refusals. Learners check
 * themselves in while the session is on; the facilitator confirms the register from those check-ins.
 */

export type Mark = "present" | "absent";

export interface RosterEntry {
  learner_id: string;
  full_name: string;
  learner_number: string | null;
  /** False for a learner who has left the cohort since being marked; they stay on the register. */
  enrolled: boolean;
  status: Mark | null;
  /** When the learner marked themselves present, or null. */
  checked_in_at: string | null;
}

export interface Amendment {
  learner_name: string;
  previous_status: Mark | null;
  status: Mark;
  reason: string;
  changed_by_name: string;
  changed_at: string;
  register_version: number;
}

export const MARK_LABELS: Record<Mark, string> = { present: "Present", absent: "Absent" };

export const REGISTER_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  not_found: "This session is not one you take the register for.",
  session_cancelled: "This session was cancelled, so it has no register.",
  not_started: "The register can be confirmed once the session has started.",
  stale: "Someone saved this register while you had it open. Your changes were not saved: check it again below.",
  invalid_marks: "The register could not be read. Reload the page and try again.",
  not_on_roster: "One of those learners is not on this session's roster. Reload the page and try again.",
  incomplete: "Mark every learner present or absent before confirming the register.",
  reason_required: "Say why the register is being changed. It is kept with the change.",
  reason_too_long: "The reason is longer than 500 characters. Shorten it and try again.",
  unchanged: "Nothing was changed, so nothing was saved.",
  error: "The register could not be saved. Try again.",
};

/** "12 present, 2 absent" (and how many are still to be marked, when any are). */
export function registerSummary(roster: Pick<RosterEntry, "status">[]): string {
  const present = roster.filter((entry) => entry.status === "present").length;
  const absent = roster.filter((entry) => entry.status === "absent").length;
  const unmarked = roster.length - present - absent;
  const parts = [`${present} present`, `${absent} absent`];
  if (unmarked > 0) parts.push(`${unmarked} not marked`);
  return parts.join(", ");
}

/** "9 of 12 checked in". */
export function checkinSummary(roster: Pick<RosterEntry, "checked_in_at">[]): string {
  const checked = roster.filter((entry) => entry.checked_in_at).length;
  return `${checked} of ${roster.length} checked in`;
}

/**
 * The marks the register opens with. Before it is confirmed, the check-ins fill it in: checked in is present, not
 * checked in is absent, and the facilitator changes any that is wrong. Once confirmed, the saved marks.
 */
export function initialMarks(roster: RosterEntry[], confirmed: boolean): Map<string, Mark | null> {
  return new Map(
    roster.map((entry) => [
      entry.learner_id,
      confirmed ? entry.status : (entry.status ?? (entry.checked_in_at ? "present" : "absent")),
    ]),
  );
}

/** "Absent to Present", or "Added as Absent" for a learner marked for the first time in an amendment. */
export function amendmentText(amendment: Pick<Amendment, "previous_status" | "status">): string {
  return amendment.previous_status
    ? `${MARK_LABELS[amendment.previous_status]} to ${MARK_LABELS[amendment.status]}`
    : `Added as ${MARK_LABELS[amendment.status]}`;
}

/** The marks a form sends: `mark:<learner id>` fields. Only learners with a mark are included. */
export function marksFromForm(entries: [string, FormDataEntryValue][]): { learner_id: string; status: Mark }[] {
  return entries
    .filter(([name, value]) => name.startsWith("mark:") && (value === "present" || value === "absent"))
    .map(([name, value]) => ({ learner_id: name.slice(5), status: value as Mark }));
}
