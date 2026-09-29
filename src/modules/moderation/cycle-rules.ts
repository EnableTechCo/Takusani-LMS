import { formatDateTime, formatDay, formatLongDayOf, sastDaysBetween } from "@/lib/dates";

/**
 * Moderation planning (C-06; FR-501, FR-506; ADR-019; P-02): what a cycle is, how far the pending pool has aged,
 * and what a refusal means, in words. Pure rules over the rows the page reads, so the page is only layout.
 */

export type CycleState = "planned" | "frozen" | "signed_off" | "cancelled";

export const CYCLE_STATE_LABELS: Record<CycleState, string> = {
  planned: "Planned",
  frozen: "Frozen and sampled",
  signed_off: "Signed off",
  cancelled: "Cancelled before freeze",
};

export interface CycleRow {
  id: string;
  name: string;
  state: string;
  unit_ids: string[];
  period_from: string | null;
  period_to: string | null;
  scheduled_start_at: string | null;
  planned_by_name: string;
  planned_at: string;
  frozen_at: string | null;
  cancelled_by_name: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  version: number;
  items: { id: string; title: string; via_unit_id: string | null }[];
  waiting: number;
  held: number;
  sampled: number;
  /** Sample items agreed, on the original decision or on a re-mark. */
  concluded: number;
  /** Items returned to an assessor and not yet re-marked; sign-off waits for them (FR-510). */
  returned: number;
  signed_off_at: string | null;
  signed_off_by_name: string | null;
  released_count: number | null;
}

export interface SampleRecord {
  cycle_id: string;
  frozen_at: string;
  frozen_by_name: string | null;
  population: number;
  digest: string;
  sample_size: number;
  mandatory_nyc: number;
  mandatory_first_time: number;
  random_draw: number;
  percentage: number;
  rule_version: number;
  algorithm_version: string;
  seed: string;
  strata: { stratum: string; population: number; sampled: number; why: string }[];
  allocations: { moderator_name: string; count: number }[];
  unallocated: number;
}

/** "23% of the population". */
export function sampleShareText(sampleSize: number, population: number): string {
  return population > 0 ? `${Math.round((sampleSize / population) * 100)}% of the population` : "No population";
}

/** "6 Not yet competent · 4 by a first-time assessor". */
export function mandatoryText(nyc: number, firstTime: number): string {
  const parts: string[] = [];
  if (nyc > 0) parts.push(`${nyc} Not yet competent`);
  if (firstTime > 0) parts.push(`${firstTime} by a first-time assessor`);
  return parts.length ? parts.join(" · ") : "None";
}

/** "All 22 allocated to Anil Naidoo" or "12 to Anil Naidoo, 10 to Thabo Nkosi; 1 waits for a moderator". */
export function allocationsText(record: Pick<SampleRecord, "allocations" | "unallocated" | "sample_size">): string {
  const parts = record.allocations.map((a) => `${a.count} to ${a.moderator_name}`);
  const shared =
    record.allocations.length === 1 && record.unallocated === 0
      ? `All ${record.sample_size} allocated to ${record.allocations[0].moderator_name}`
      : parts.join(", ");
  if (record.unallocated === 0) return shared || "Nothing to allocate";
  const waiting = `${record.unallocated} ${record.unallocated === 1 ? "waits" : "wait"} for a moderator: everyone eligible assessed ${record.unallocated === 1 ? "it" : "them"}`;
  return shared ? `${shared}; ${waiting}` : waiting;
}

export interface PoolRow {
  item_id: string;
  title: string;
  kind: string;
  unit_id: string | null;
  unit_code: string | null;
  unit_title: string | null;
  waiting: number;
  oldest_decided_at: string | null;
  assessors: { name: string; count: number }[];
  held: number;
  released: number;
  open_cycle_id: string | null;
  open_cycle_name: string | null;
  open_cycle_state: string | null;
  open_cycle_scheduled_start_at: string | null;
  /** Waiting results that every eligible moderator assessed: nobody could be allocated them (BR-01). */
  unmoderatable: number;
}

export interface ModeratorRow {
  profile_id: string;
  full_name: string;
  /** Waiting results in the cohort this moderator assessed, and so can never be given. */
  assessed_waiting: number;
  /** Items they hold in frozen cycles that are not concluded. */
  holds_open: number;
}

export interface PoolSummary {
  moderation_policy: string | null;
  max_hold_days: number | null;
  sampling_percentage: number | null;
  sampling_rule: string | null;
  sampling_rule_version: number | null;
  waiting: number;
  oldest_waiting_at: string | null;
  held: number;
  oldest_held_at: string | null;
  planned_cycles: number;
  frozen_cycles: number;
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "Planned. Starts by itself on 14 Sep 2026, 09:00" or "Planned. Freezes when you choose". */
export function cycleStateText(
  cycle: Pick<CycleRow, "state" | "scheduled_start_at" | "held"> &
    Partial<Pick<CycleRow, "returned" | "signed_off_at" | "signed_off_by_name" | "released_count">>,
): string {
  switch (cycle.state) {
    case "planned":
      return cycle.scheduled_start_at
        ? `Planned. Starts by itself on ${formatDateTime(cycle.scheduled_start_at)}`
        : "Planned. Freezes when you choose";
    case "frozen":
      return cycle.returned
        ? `Frozen and sampled. ${count(cycle.held, "result held", "results held")}; waiting for ${count(cycle.returned, "re-mark", "re-marks")}`
        : `Frozen and sampled. ${count(cycle.held, "result held", "results held")}`;
    case "signed_off":
      return cycle.signed_off_at
        ? `Signed off by ${cycle.signed_off_by_name ?? "a moderator"}, ${formatDateTime(cycle.signed_off_at)}. ${count(cycle.released_count ?? 0, "result released", "results released")}`
        : "Signed off";
    default:
      return CYCLE_STATE_LABELS.cancelled;
  }
}

/** "Automatically, 14 Sep 2026, 09:00" or "When chosen". */
export function startText(scheduledStartAt: string | null): string {
  return scheduledStartAt ? `Automatically, ${formatDateTime(scheduledStartAt)}` : "When chosen";
}

/** The scope in words: whole units first, then items named on their own. */
export function scopeText(
  cycle: Pick<CycleRow, "unit_ids" | "items">,
  units: { id: string; code: string | null; title: string | null }[],
): string {
  const unitNames = cycle.unit_ids.map((id) => {
    const unit = units.find((row) => row.id === id);
    return unit ? `Unit ${unit.code ?? ""}${unit.title ? `: ${unit.title}` : ""} (every assignment)` : "A whole unit";
  });
  const named = cycle.items.filter((item) => item.via_unit_id === null).map((item) => item.title);
  const parts = [...unitNames, ...named];
  return parts.length ? parts.join("; ") : "Nothing yet";
}

/** "Only results decided from 1 Sep 2026 to 30 Sep 2026", or null when the whole pool. */
export function periodText(from: string | null, to: string | null): string | null {
  if (!from && !to) return null;
  if (from && to) return `Only results decided from ${formatDay(from)} to ${formatDay(to)}`;
  if (from) return `Only results decided from ${formatDay(from)}`;
  return `Only results decided up to ${formatDay(to!)}`;
}

/** Whole South African days since the oldest waiting decision. */
export function holdDays(oldestIso: string | null, now: Date): number {
  return oldestIso ? Math.max(0, sastDaysBetween(oldestIso, now.toISOString())) : 0;
}

/** "4 of 21 days", or "4 days" when no maximum is set. */
export function holdText(days: number, maxDays: number | null): string {
  return maxDays ? `${days} of ${maxDays} days` : count(days, "day", "days");
}

/** Past the maximum hold, or within three days of it (P-03). */
export function holdCaution(days: number, maxDays: number | null): boolean {
  return maxDays !== null && days >= Math.max(0, maxDays - 3);
}

/** "Nomsa Dlamini 2 · Zanele Khumalo 1". */
export function assessorsText(assessors: { name: string; count: number }[]): string {
  return assessors.map((assessor) => `${assessor.name} ${assessor.count}`).join(" · ");
}

/** What will happen to an item's waiting results, for the pool table. */
export function itemFateText(
  row: Pick<PoolRow, "waiting" | "open_cycle_name" | "open_cycle_state" | "open_cycle_scheduled_start_at">,
): {
  text: string;
  tone: "caution" | "info" | "neutral";
} {
  if (row.waiting === 0) return { text: "Nothing waiting", tone: "neutral" };
  if (!row.open_cycle_name) return { text: "Not in any cycle", tone: "caution" };
  if (row.open_cycle_state === "frozen") {
    return { text: `Waiting for the next cycle: "${row.open_cycle_name}" is already frozen`, tone: "caution" };
  }
  return {
    text: row.open_cycle_scheduled_start_at
      ? `"${row.open_cycle_name}" claims them on ${formatDateTime(row.open_cycle_scheduled_start_at)}`
      : `"${row.open_cycle_name}" claims them when it is frozen`,
    tone: "info",
  };
}

/** The sentence at the top of the page: the pool, its age, and whether a cycle will release it. */
export function poolLead(summary: PoolSummary, now: Date): string {
  if (summary.moderation_policy !== "moderated") {
    return "This cohort is not moderated: results are released as soon as the assessor decides.";
  }
  if (summary.waiting === 0 && summary.held === 0) {
    return "Every result in this cohort is held from the moment the assessor decides, until a cycle that covers it is signed off. Nothing is waiting right now.";
  }
  const parts: string[] = [];
  if (summary.waiting > 0) {
    const age = holdDays(summary.oldest_waiting_at, now);
    parts.push(
      `${count(summary.waiting, "result is", "results are")} waiting for a cycle` +
        (summary.oldest_waiting_at
          ? `; the oldest was decided ${age === 0 ? "today" : count(age, "day ago", "days ago")}, on ${formatLongDayOf(summary.oldest_waiting_at)}`
          : ""),
    );
  }
  if (summary.held > 0) parts.push(`${count(summary.held, "result is", "results are")} held in a frozen cycle`);
  const sentence = parts.join(", and ");
  const cycles =
    summary.waiting > 0 && summary.planned_cycles === 0 ? " No cycle is planned to release the waiting results." : "";
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.${cycles}`;
}

/** The sampling rule in force, read-only on the plan form. */
export function samplingRuleText(
  summary: Pick<PoolSummary, "sampling_rule" | "sampling_rule_version" | "sampling_percentage">,
): string {
  const rule =
    summary.sampling_rule === "stratified"
      ? "stratified by assessor, outcome and unit"
      : (summary.sampling_rule ?? "not set");
  return `Version ${summary.sampling_rule_version ?? "?"}: ${summary.sampling_percentage ?? "?"}% of Competent results at random, ${rule}; every Not yet competent decision and every first-time assessor's decisions.`;
}

/**
 * The moderators available to a cycle, each with what they cannot be given: "Thabo Nkosi assessed none of the 96
 * waiting results, so can be given any of them. Zanele Khumalo assessed 3, so cannot be given those."
 */
export function moderatorsText(moderators: ModeratorRow[], waiting: number): string {
  if (moderators.length === 0)
    return "No moderator's role covers this cohort. The coordinator must assign one before a cycle can be sampled.";
  return moderators
    .map((moderator) =>
      moderator.assessed_waiting === 0
        ? `${moderator.full_name} assessed none of the ${count(waiting, "waiting result", "waiting results")}, so can be given any of them`
        : `${moderator.full_name} assessed ${moderator.assessed_waiting}, so cannot be given those`,
    )
    .join(". ")
    .concat(".");
}

/** The warning for items whose waiting results every moderator assessed (BR-01), or null. */
export function noModeratorText(items: Pick<PoolRow, "title" | "unmoderatable">[]): string | null {
  const affected = items.filter((item) => item.unmoderatable > 0);
  if (affected.length === 0) return null;
  const total = affected.reduce((sum, item) => sum + item.unmoderatable, 0);
  return `${count(total, "waiting result has", "waiting results have")} no eligible moderator: every moderator of the cohort assessed ${total === 1 ? "it" : "them"} (${affected.map((item) => `${item.unmoderatable} for ${item.title}`).join("; ")}). If sampled, ${total === 1 ? "it waits" : "they wait"} for a moderator and block sign-off until the coordinator assigns one who assessed none of them.`;
}

/** The P-03 alert: what has waited longer than the configured maximum hold, or null. */
export function holdAlertText(summary: PoolSummary, now: Date): string | null {
  const max = summary.max_hold_days;
  if (max === null) return null;
  const waiting = summary.oldest_waiting_at !== null && holdDays(summary.oldest_waiting_at, now) > max;
  const held = summary.oldest_held_at !== null && holdDays(summary.oldest_held_at, now) > max;
  if (!waiting && !held) return null;
  const parts: string[] = [];
  if (waiting)
    parts.push(
      `the oldest result waiting for a cycle was decided ${count(holdDays(summary.oldest_waiting_at!, now), "day", "days")} ago`,
    );
  if (held)
    parts.push(
      `the oldest result held in a frozen cycle was decided ${count(holdDays(summary.oldest_held_at!, now), "day", "days")} ago`,
    );
  return `Past the ${max}-day maximum hold: ${parts.join(", and ")}. ${waiting ? "Plan and freeze a cycle that covers it. " : ""}${held ? "The cycle holding it must be signed off." : ""}`.trim();
}

/** A cycle's progress as steps for the Stepper, from the row the coordinator reads. */
export function cycleSteps(
  cycle: Pick<
    CycleRow,
    | "state"
    | "planned_by_name"
    | "planned_at"
    | "frozen_at"
    | "scheduled_start_at"
    | "sampled"
    | "held"
    | "concluded"
    | "returned"
    | "signed_off_at"
    | "signed_off_by_name"
    | "released_count"
    | "cancelled_at"
    | "cancelled_by_name"
  >,
): { label: string; state: "complete" | "current" | "blocked" | "upcoming" | "skipped"; meta?: string }[] {
  const frozen = cycle.state === "frozen" || cycle.state === "signed_off";
  const signed = cycle.state === "signed_off";
  const reviewDone = frozen && cycle.concluded === cycle.sampled;
  if (cycle.state === "cancelled") {
    return [
      {
        label: "Planned",
        state: "complete",
        meta: `${cycle.planned_by_name}, ${formatDay(cycle.planned_at.slice(0, 10))}`,
      },
      {
        label: "Cancelled",
        state: "current",
        meta: cycle.cancelled_at
          ? `${cycle.cancelled_by_name ?? ""}, ${formatDateTime(cycle.cancelled_at)}`
          : undefined,
      },
      { label: "Frozen and sampled", state: "skipped" },
      { label: "In review", state: "skipped" },
      { label: "Signed off", state: "skipped" },
    ];
  }
  return [
    { label: "Planned", state: "complete", meta: `${cycle.planned_by_name}, ${formatDateTime(cycle.planned_at)}` },
    {
      label: "Frozen and sampled",
      state: frozen ? "complete" : "current",
      meta:
        frozen && cycle.frozen_at
          ? `${formatDateTime(cycle.frozen_at)} · ${cycle.sampled} of ${cycle.held}`
          : startText(cycle.scheduled_start_at),
    },
    {
      label: cycle.returned > 0 ? "Waiting for re-marks" : "In review",
      state: signed || reviewDone ? "complete" : frozen ? (cycle.returned > 0 ? "blocked" : "current") : "upcoming",
      meta: frozen
        ? `${cycle.concluded} of ${cycle.sampled} concluded${cycle.returned > 0 ? ` · ${cycle.returned} returned` : ""}`
        : undefined,
    },
    {
      label: "Signed off",
      state: signed ? "complete" : reviewDone ? "current" : "upcoming",
      meta:
        signed && cycle.signed_off_at
          ? `${cycle.signed_off_by_name ?? ""}, ${formatDateTime(cycle.signed_off_at)} · ${count(cycle.released_count ?? 0, "result released", "results released")}`
          : `Releases ${frozen ? `all ${cycle.held}` : "the frozen"} results`,
    },
  ];
}

export const MODERATION_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  forbidden: "You do not coordinate this cohort.",
  cohort_not_found: "This cohort no longer exists, or is archived.",
  not_moderated: "This cohort is not moderated, so it has no cycles. Change the policy on the setup page first.",
  invalid_name: "Give the cycle a name of up to 120 characters. Moderators and assessors see it.",
  unknown_item: "One of the chosen assignments is not in this cohort.",
  unknown_unit: "One of the chosen units is not in this programme.",
  empty_scope: "Choose at least one assignment or unit.",
  invalid_period: "The period runs backwards: the end is before the start.",
  start_in_past: "Choose a start in the future, or freeze the cycle when you choose.",
  not_found: "This cycle no longer exists, or is not in a cohort you coordinate.",
  not_planned: "This cycle is no longer planned: it has been frozen or cancelled, so it cannot be cancelled.",
  stale_version: "This cycle changed while you had the page open. Reload it; nothing was changed.",
  reason_required: "Say why the cycle is cancelled, in up to 500 characters. It is kept with the cycle.",
  nothing_to_freeze:
    "Nothing is waiting in this cycle's scope, so there is nothing to freeze. It can freeze once a result is decided.",
  error: "It could not be saved. Try again.",
};
