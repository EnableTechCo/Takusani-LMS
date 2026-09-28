import { formatDateTime } from "@/lib/dates";
import { ROLE_LABELS } from "./access";
import type { Role } from "./navigation";

/** Role administration (S3-07; FR-104, FR-105, FR-107; U-01): the words for each refusal, advisory and change. */

export const ROLE_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was changed.",
  not_found: "This account no longer exists.",
  account_inactive: "This account is deactivated, so it cannot be given a role.",
  invalid_role: "Choose a role.",
  invalid_scope: "Choose where the role applies.",
  forbidden: "You cannot assign or end this role in that scope. Nothing was changed.",
  invalid_until: "The end date must be in the future.",
  already_assigned: "This person already holds that role in that scope. Nothing was changed.",
  already_ended: "This role has already ended. Nothing was changed.",
  not_started: "This role was assigned a moment ago. Try again in a second.",
  error: "The change could not be made. Try again.",
};

export interface Advisory {
  type: string;
  item_title: string;
  cohort_name: string;
  results: number;
  first_decided_at: string;
  last_decided_at: string;
}

export interface BlockingAllocation {
  kind: string;
  cohort_name: string | null;
  items: number;
  oldest_at: string | null;
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

export function resultsText(count: number): string {
  return count === 1 ? "1 result" : `${count} results`;
}

export function itemsText(count: number): string {
  return count === 1 ? "1 item" : `${count} items`;
}

/** The total an advisory covers, for its heading. */
export function advisoryTotal(advisories: Advisory[]): number {
  return advisories.reduce((sum, advisory) => sum + advisory.results, 0);
}

export interface HistoryEntry {
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  details: Record<string, unknown> | null;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** "Assessor, 2026 Intake B". */
function roleAndScope(values: Record<string, unknown> | null): string {
  if (!values) return "a role";
  return `${roleLabel(text(values.role))}, ${text(values.scope_label) || "a scope"}`;
}

/**
 * FR-107: one sentence per change, after the actor's name, with the previous value. Unknown actions fall back to
 * their code, so nothing on the record is ever hidden.
 */
export function historySentence(entry: HistoryEntry): string {
  switch (entry.action) {
    case "identity.account_created":
      return "created the account.";
    case "identity.role_assigned": {
      const until = text(entry.after?.until);
      const advised = Number(entry.details?.advisory_results ?? 0);
      return [
        `assigned ${roleAndScope(entry.after)}${until ? `, until ${formatDateTime(until)}` : ""}. Previous value: none.`,
        advised > 0 ? `Advisory shown: kept away from ${resultsText(advised)} they assessed.` : "",
      ]
        .filter(Boolean)
        .join(" ");
    }
    case "identity.role_ended": {
      const was = text(entry.before?.until);
      return `ended ${roleAndScope(entry.before)}. Previous value: ${was ? `until ${formatDateTime(was)}` : "no end date"}.`;
    }
    case "identity.role_end_refused":
      return `tried to end ${roleAndScope(entry.before)}. Refused: open work depends on it. Nothing was changed.`;
    case "identity.account_updated": {
      const before = entry.before ?? {};
      const after = entry.after ?? {};
      const changes = [
        before.full_name !== after.full_name ? `name from ${text(before.full_name)} to ${text(after.full_name)}` : "",
        before.learner_number !== after.learner_number
          ? `learner number from ${text(before.learner_number) || "none"} to ${text(after.learner_number) || "none"}`
          : "",
      ].filter(Boolean);
      return `changed the ${changes.join(" and the ") || "details"}.`;
    }
    case "identity.account_deactivated": {
      const reason = text(entry.details?.reason);
      return `deactivated the account.${reason ? ` Reason given: ${reason.replace(/\.$/, "")}.` : ""} Previous value: active.`;
    }
    case "identity.account_reactivated":
      return "reactivated the account. Previous value: deactivated.";
    case "identity.deactivation_refused":
      return "tried to deactivate the account. Refused: open work is still allocated. Nothing was changed.";
    case "identity.password_reset_sent":
      return "sent a password reset link.";
    case "identity.sign_in_locked":
      return "New sign-ins were locked after repeated wrong passwords.";
    case "identity.sign_in_lock_expired":
      return "The sign-in lock ended by itself.";
    case "identity.sign_in_lock_cleared":
      return "The sign-in lock was cleared by a password reset.";
    case "identity.sign_in_unlocked":
      return "unlocked sign-in to the account.";
    default:
      return entry.action;
  }
}

/** Whether a history entry is a refusal, marked in the log. */
export function isRefusal(action: string): boolean {
  return action.endsWith("_refused");
}
