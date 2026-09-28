/** Coordinator notices (S2-17, FR-703): who a notice is for, and refusals, in words. */

export function audienceLabel(notice: { audience: string; cohort_name: string | null; role: string | null }): string {
  if (notice.audience === "cohort") return `Learners in ${notice.cohort_name ?? "a cohort"}`;
  if (notice.audience === "role") return `All ${ROLE_PLURALS[notice.role ?? ""] ?? notice.role}`;
  return "Everyone";
}

const ROLE_PLURALS: Record<string, string> = {
  learner: "learners",
  facilitator: "facilitators",
  assessor: "assessors",
  moderator: "moderators",
  coordinator: "coordinators",
  administrator: "administrators",
};

export function noticeStateLabel(state: string): "Scheduled" | "Sent" | "Cancelled" {
  return state === "sent" ? "Sent" : state === "cancelled" ? "Cancelled" : "Scheduled";
}

export const NOTICE_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again.",
  forbidden:
    "You cannot send a notice to that audience. A cohort you coordinate is open to you; role groups and everyone need an institution-wide coordinator.",
  invalid_title: "Enter a title of up to 150 characters.",
  invalid_body: "Write the message, up to 2,000 characters.",
  invalid_audience: "Choose who it is for.",
  cohort_not_found: "Choose a cohort.",
  invalid_role: "Choose a role group.",
  send_in_past: "Choose a time from now on.",
  not_found: "This notice no longer exists.",
  already_sent: "This notice has already been sent.",
  error: "The notice could not be saved. Try again.",
};
