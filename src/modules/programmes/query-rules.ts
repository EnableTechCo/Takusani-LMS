import { formatDay } from "@/lib/dates";

/** Stakeholder queries (C-10, FR-704): the words for their sources, states, history and refusals. */

export const QUERY_SOURCE_LABELS: Record<string, string> = {
  learner: "A learner",
  employer: "An employer",
  funder: "A funder",
  department: "The Department",
  staff: "A staff member",
  other: "Someone else",
};

export const QUERY_STATE_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  closed: "Closed",
};

export const QUERY_SHOW = ["open", "mine", "closed", "all"] as const;
export type QueryShow = (typeof QUERY_SHOW)[number];
export const QUERY_SHOW_LABELS: Record<QueryShow, string> = {
  open: "Open",
  mine: "Mine",
  closed: "Closed",
  all: "All",
};

export function parseQueryShow(value: string | undefined): QueryShow {
  return (QUERY_SHOW as readonly string[]).includes(value ?? "") ? (value as QueryShow) : "open";
}

export interface QueryEvent {
  event: string;
  actor_name: string;
  owner_name: string | null;
  note: string | null;
  at: string;
}

/** One line of a query's history, for example "Routed to Zanele Khumalo by Ayesha Patel". */
export function eventText(event: QueryEvent): string {
  switch (event.event) {
    case "logged":
      return `Logged by ${event.actor_name}`;
    case "routed":
      return `Routed to ${event.owner_name ?? "someone"} by ${event.actor_name}`;
    case "started":
      return `Started by ${event.actor_name}`;
    case "noted":
      return `Note from ${event.actor_name}`;
    case "closed":
      return `Closed by ${event.actor_name}`;
    case "reopened":
      return `Reopened by ${event.actor_name}`;
    default:
      return event.event;
  }
}

/** When it is due, in words, and whether it is late: "Due Mon 5 Oct 2026" or "Overdue: due 5 Oct 2026". */
export function dueText(dueOn: string | null, state: string, today: string): { text: string; late: boolean } | null {
  if (!dueOn) return null;
  const late = state !== "closed" && dueOn < today;
  return { text: late ? `Overdue: due ${formatDay(dueOn)}` : `Due ${formatDay(dueOn)}`, late };
}

export const QUERY_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  forbidden:
    "You do not coordinate this programme. If you coordinate one of its cohorts, choose that cohort for the query.",
  programme_not_found: "Choose the programme the query is about.",
  cohort_not_in_programme: "That cohort is not in the programme you chose.",
  invalid_source_type: "Choose who the query is from.",
  invalid_source_name: "Say who raised it, in up to 200 characters.",
  invalid_contact: "Keep the contact details to 200 characters.",
  invalid_subject: "Give the query a subject, in up to 200 characters.",
  invalid_details: "Say what they asked, in up to 5,000 characters.",
  due_in_past: "Choose today or a later day.",
  not_found: "This query is not one you can see.",
  closed: "This query is closed. Reopen it first.",
  owner_not_eligible: "Choose a coordinator who covers this query.",
  unchanged: "It is already with them. Nothing was changed.",
  invalid_note: "Keep the note to 5,000 characters.",
  not_open: "It is already in progress.",
  note_required: "Write the note first.",
  resolution_required: "Say how it was resolved. The person who raised it may ask.",
  not_closed: "It is not closed.",
  reason_required: "Say why it is being reopened.",
  invalid_action: "That is not something a query can do.",
  error: "It could not be saved. Try again.",
};
