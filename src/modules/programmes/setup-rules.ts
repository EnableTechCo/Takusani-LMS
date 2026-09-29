/** Cohort setup (S4-03; FR-701, FR-702; P-01): the words for the cohort's state, its checklist and refusals. */

export const COHORT_STATUS_LABELS: Record<string, string> = {
  setup: "Setting up",
  active: "Active",
  archived: "Archived",
};

export interface ReadinessItem {
  label: string;
  /** What the item means, and how it is done. */
  help: string;
}

export const READINESS_ITEMS: Record<string, ReadinessItem> = {
  details: { label: "Programme, name and dates", help: "Set when the cohort was created." },
  moderation_policy: {
    label: "Moderation policy confirmed",
    help: "There is no default. Choose Moderated or Not moderated on the setup page.",
  },
  learners: { label: "Learners enrolled", help: "Enrol them on the People page, or import an intake." },
  facilitator: { label: "A facilitator assigned", help: "Assign one on the People page." },
  assessor: { label: "At least one assessor assigned", help: "Assign one on the People page." },
  moderator: {
    label: "A moderator assigned",
    help: "Needed for a moderated cohort, to review samples and sign off cycles.",
  },
  materials: { label: "Learning material published", help: "A facilitator publishes it under Materials." },
  published_tasks: { label: "An assignment published", help: "A facilitator publishes it under Assignments." },
  sessions: { label: "A session scheduled", help: "A facilitator schedules it under Sessions." },
  logistics: {
    label: "Logistics arranged",
    help: "The venue, catering and equipment for every upcoming in-person session, arranged under Logistics.",
  },
  unit_requirements: {
    label: "Unit credit requirements frozen",
    help: "Choose which assessments each unit needs before its credits are awarded, then freeze the list under Credits.",
  },
};

/** "3 learners", "1 assessor": what the checklist counted. */
export function readinessDetail(key: string, detail: string | null, policy: string | null): string | null {
  if (detail === null) return null;
  if (key === "moderation_policy") return detail === "moderated" ? "Moderated" : "Not moderated";
  if (key === "logistics") {
    if (detail === "none_in_person") return "No in-person sessions, so nothing to arrange";
    const [arranged, total] = detail.split("/").map(Number);
    return `${arranged} of ${total} in-person ${total === 1 ? "session" : "sessions"} arranged`;
  }
  if (key === "unit_requirements") return `Version ${detail} in force`;
  const count = Number(detail);
  if (key === "moderator" && policy === "not_moderated" && count === 0) return "Not needed: not moderated";
  const nouns: Record<string, [string, string]> = {
    learners: ["learner", "learners"],
    facilitator: ["facilitator", "facilitators"],
    assessor: ["assessor", "assessors"],
    moderator: ["moderator", "moderators"],
    materials: ["material", "materials"],
    published_tasks: ["assignment", "assignments"],
    sessions: ["session", "sessions"],
  };
  const noun = nouns[key];
  return noun ? `${count} ${count === 1 ? noun[0] : noun[1]}` : null;
}

export const SETUP_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was changed.",
  not_found: "This cohort is not one you coordinate.",
  archived: "This cohort is archived, so nothing about it can be changed.",
  invalid_policy: "Choose Moderated or Not moderated.",
  stale: "Someone changed the policy while you had this page open. Nothing was changed: check it again below.",
  unchanged: "That is the policy already in force. Nothing was changed.",
  reason_required: "Say why the policy is changing. It is kept in the policy history.",
  reason_too_long: "The reason is longer than 1,000 characters. Shorten it.",
  results_pending_or_held: "The policy was not changed: results are waiting or held.",
  not_ready: "The cohort cannot be activated yet.",
  not_in_setup: "This cohort is already active.",
  invalid_item: "That checklist item does not exist.",
  already_done: "That item is already done, so it needs no one.",
  not_staff: "Choose someone on this cohort's staff.",
  note_too_long: "The note is longer than 500 characters.",
  due_in_past: "Choose today or a later day.",
  invalid_role: "Choose facilitator, assessor or moderator.",
  account_not_found: "No account uses that email address. An administrator creates the account first.",
  error: "The change could not be saved. Try again.",
};

/** "results that are waiting" and "held" in words, for the refusal panel. */
export function unreleasedText(waiting: number, held: number): string {
  const parts = [];
  if (waiting > 0)
    parts.push(`${waiting} ${waiting === 1 ? "result is" : "results are"} decided and waiting for a moderation cycle`);
  if (held > 0) parts.push(`${held} ${held === 1 ? "is" : "are"} held in a cycle`);
  return parts.join(", and ");
}
