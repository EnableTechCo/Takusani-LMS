import { needsCoordinator } from "@/modules/appeals/rules";
import { READINESS_ITEMS } from "./setup-rules";

/**
 * Coordinator overview (C-01; FR-604, FR-702, FR-707): what needs attention across the coordinator's cohorts.
 * Pure rules over the lists the workspace already reads, so the page is only layout.
 */

export interface AppealRow {
  id: string;
  reference: string;
  learner_name: string;
  item_title: string;
  cohort_name: string;
  type: string;
  state: string;
  lodged_at: string;
}

/** Appeals the coordinator must act on (check, or allocate a reviewer), longest waiting first. */
export function appealsWaiting<A extends AppealRow>(appeals: A[]): A[] {
  return appeals
    .filter((appeal) => needsCoordinator(appeal.type, appeal.state))
    .sort((a, b) => a.lodged_at.localeCompare(b.lodged_at));
}

export interface ReadinessRow {
  item_key: string;
  done: boolean;
  due_on: string | null;
  assignee_name: string | null;
  gate: boolean;
}

export interface OpenReadinessItem {
  cohortId: string;
  cohortName: string;
  itemKey: string;
  label: string;
  dueOn: string | null;
  assigneeName: string | null;
  gate: boolean;
  /** Its due date has passed. */
  overdue: boolean;
}

/**
 * Checklist items still open in cohorts being set up: overdue first, then the soonest due, then by cohort. Items with
 * no date come last. `today` is the South African date.
 */
export function openReadiness(
  cohorts: { id: string; name: string; status: string }[],
  itemsByCohort: Record<string, ReadinessRow[] | undefined>,
  today: string,
): OpenReadinessItem[] {
  const items: OpenReadinessItem[] = [];
  for (const cohort of cohorts) {
    if (cohort.status !== "setup") continue;
    for (const item of itemsByCohort[cohort.id] ?? []) {
      if (item.done) continue;
      items.push({
        cohortId: cohort.id,
        cohortName: cohort.name,
        itemKey: item.item_key,
        label: READINESS_ITEMS[item.item_key]?.label ?? item.item_key,
        dueOn: item.due_on,
        assigneeName: item.assignee_name,
        gate: item.gate,
        overdue: item.due_on !== null && item.due_on < today,
      });
    }
  }
  const rank = (item: OpenReadinessItem) => (item.overdue ? 0 : 1);
  const due = (item: OpenReadinessItem) => item.dueOn ?? "9999-12-31";
  return items.sort(
    (a, b) =>
      rank(a) - rank(b) ||
      due(a).localeCompare(due(b)) ||
      a.cohortName.localeCompare(b.cohortName) ||
      a.label.localeCompare(b.label),
  );
}

export interface LogisticsRow {
  session_id: string;
  title: string;
  cohort_name: string;
  starts_at: string;
  session_state: string;
  variance_flagged: boolean;
  present: number | null;
  headcount: number | null;
}

/** Sessions whose attendance differed from the confirmed headcount and are not reconciled yet, latest first. */
export function variancesToReconcile<L extends LogisticsRow>(rows: L[]): L[] {
  return rows
    .filter((row) => row.variance_flagged && row.session_state !== "cancelled")
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
}

export interface QueryRow {
  id: string;
  reference: string;
  subject: string;
  source_name: string;
  state: string;
  owner_id: string | null;
  due_on: string | null;
  logged_at: string;
}

export type QueryAttention = "not_routed" | "overdue";

/** Open queries nobody owns yet, then open queries past their date; the longest logged first within each. */
export function queriesNeedingAttention<Q extends QueryRow>(queries: Q[], today: string) {
  const items: (Q & { attention: QueryAttention })[] = [];
  for (const query of queries) {
    if (query.state === "closed") continue;
    if (query.owner_id === null) items.push({ ...query, attention: "not_routed" });
    else if (query.due_on !== null && query.due_on < today) items.push({ ...query, attention: "overdue" });
  }
  const rank = (item: { attention: QueryAttention }) => (item.attention === "not_routed" ? 0 : 1);
  return items.sort((a, b) => rank(a) - rank(b) || a.logged_at.localeCompare(b.logged_at));
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function sentenceOf(parts: string[]): string {
  const sentence = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

/** The one-line summary under the title, in words. */
export function coordinateLead(counts: {
  appeals: number;
  readiness: number;
  variances: number;
  queries: number;
}): string {
  const parts: string[] = [];
  if (counts.appeals > 0) parts.push(count(counts.appeals, "appeal needs you", "appeals need you"));
  if (counts.readiness > 0) parts.push(count(counts.readiness, "setup item is open", "setup items are open"));
  if (counts.variances > 0) {
    parts.push(count(counts.variances, "attendance difference to reconcile", "attendance differences to reconcile"));
  }
  if (counts.queries > 0) {
    parts.push(count(counts.queries, "query needs routing or is overdue", "queries need routing or are overdue"));
  }
  if (parts.length === 0) return "Nothing needs your attention right now.";
  return sentenceOf(parts);
}
