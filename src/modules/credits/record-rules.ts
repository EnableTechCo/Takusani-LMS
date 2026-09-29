import { formatDateTime, formatDayOf } from "@/lib/dates";

/**
 * The learner's credits record (L-19, P0-09; FR-318, FR-801 to FR-804; P-07): the totals, each unit's standing and
 * the ledger history, in words. Everything comes from the ledger and released results; a result the learner cannot
 * see yet reads as "Being assessed" and carries no credit value (FR-804).
 */

export type ItemState = "competent" | "not_yet_competent" | "being_assessed" | "not_started";

export interface CreditItem {
  title: string;
  state: ItemState;
  result_id: string | null;
  deadline_at: string | null;
  due_at: string | null;
}

export interface CreditUnitRow {
  programme_id: string;
  programme_title: string;
  nqf_level: number | null;
  cohort_id: string;
  cohort_name: string;
  cohort_status: string;
  unit_id: string;
  unit_code: string;
  unit_title: string;
  credits: number | null;
  earned: number;
  awarded: boolean;
  awarded_at: string | null;
  requirements_set: boolean;
  items: CreditItem[];
}

export interface CreditProgramme {
  programmeId: string;
  title: string;
  nqfLevel: number | null;
  cohortName: string;
  cohortArchived: boolean;
  units: CreditUnitRow[];
  earned: number;
  total: number;
  outstanding: number;
  earnedUnits: CreditUnitRow[];
  outstandingUnits: CreditUnitRow[];
}

/** One programme per enrolment, with its units split into earned and outstanding. */
export function byProgramme(rows: CreditUnitRow[]): CreditProgramme[] {
  const programmes = new Map<string, CreditProgramme>();
  for (const row of rows) {
    let programme = programmes.get(row.programme_id);
    if (!programme) {
      programme = {
        programmeId: row.programme_id,
        title: row.programme_title,
        nqfLevel: row.nqf_level,
        cohortName: row.cohort_name,
        cohortArchived: row.cohort_status === "archived",
        units: [],
        earned: 0,
        total: 0,
        outstanding: 0,
        earnedUnits: [],
        outstandingUnits: [],
      };
      programmes.set(row.programme_id, programme);
    }
    programme.units.push(row);
    programme.earned += row.earned;
    programme.total += row.credits ?? 0;
    (row.awarded ? programme.earnedUnits : programme.outstandingUnits).push(row);
  }
  for (const programme of programmes.values()) programme.outstanding = Math.max(programme.total - programme.earned, 0);
  return [...programmes.values()];
}

const credits = (count: number) => `${count} ${count === 1 ? "credit" : "credits"}`;

/** "You have earned 52 of 140 credits. 88 credits are still outstanding." */
export function summarySentence(programme: Pick<CreditProgramme, "earned" | "total" | "outstanding">): string {
  if (programme.total === 0) return "The credit values for your programme have not been set yet.";
  if (programme.earned === 0)
    return `You have not earned any credits yet. All ${credits(programme.total)} are still outstanding.`;
  if (programme.outstanding === 0) return `You have earned all ${credits(programme.total)} of your programme.`;
  return `You have earned ${programme.earned} of ${credits(programme.total)}. ${credits(programme.outstanding)} ${programme.outstanding === 1 ? "is" : "are"} still outstanding.`;
}

export interface UnitStatus {
  label: string;
  tone: "positive" | "info" | "caution" | "neutral";
  shape?: "half" | "check";
}

/** Where a unit stands: earned, resubmission open, in progress, not started, or not yet set up by the cohort. */
export function unitStatus(unit: CreditUnitRow, now: Date = new Date()): UnitStatus {
  if (unit.awarded && unit.awarded_at)
    return { label: `Earned on ${formatDayOf(unit.awarded_at)}`, tone: "positive", shape: "check" };
  if (!unit.requirements_set || unit.items.length === 0) return { label: "Assessments not set yet", tone: "neutral" };
  const resubmission = unit.items.some(
    (item) =>
      item.state === "not_yet_competent" && item.deadline_at && new Date(item.deadline_at).getTime() > now.getTime(),
  );
  if (resubmission) return { label: "Resubmission open", tone: "caution" };
  const competent = unit.items.filter((item) => item.state === "competent").length;
  const started = unit.items.some((item) => item.state !== "not_started");
  if (competent > 0 || started)
    return {
      label: `In progress: ${competent} of ${unit.items.length} ${unit.items.length === 1 ? "assessment" : "assessments"} Competent`,
      tone: "info",
      shape: "half",
    };
  return { label: "Not started", tone: "neutral" };
}

export const ITEM_STATE_LABELS: Record<ItemState, string> = {
  competent: "Competent",
  not_yet_competent: "Not yet competent",
  being_assessed: "Being assessed",
  not_started: "Not started",
};

/** The line under an assessment: what the learner can do, or why it counts for nothing yet. */
export function itemNote(item: CreditItem, now: Date = new Date()): string | null {
  if (item.state === "being_assessed") return "No credit value until the result is released.";
  if (item.state === "not_yet_competent") {
    if (item.deadline_at && new Date(item.deadline_at).getTime() > now.getTime())
      return `You can resubmit until ${formatDateTime(item.deadline_at)}.`;
    return "The resubmission period has ended. Speak to your coordinator.";
  }
  if (item.state === "not_started" && item.due_at) return `Due ${formatDateTime(item.due_at)}.`;
  return null;
}

export interface HistoryRow {
  entry_id: number;
  created_at: string;
  unit_code: string;
  unit_title: string;
  credits: number;
  entry_type: string;
  cause: string;
  total: number;
}

const REVERSAL_CAUSE: Record<string, string> = {
  appeal: "reversal after an appeal decision",
  correction: "reversal after a correction",
  moderation: "reversal after moderation",
};

const AWARD_CAUSE: Record<string, string> = {
  appeal: "award after an appeal decision",
  correction: "award after a correction",
  moderation: "award after moderation",
  requirement_set: "award when the unit's assessments were confirmed",
};

/** "+12 credits" / "-8 credits", and "award · total 52" / "reversal after an appeal decision · total 44". */
export function historyLine(row: HistoryRow): { amount: string; detail: string } {
  const amount = `${row.credits >= 0 ? "+" : "−"}${credits(Math.abs(row.credits))}`;
  const what =
    row.entry_type === "reversal"
      ? (REVERSAL_CAUSE[row.cause] ?? "reversal after a later decision")
      : (AWARD_CAUSE[row.cause] ?? "award");
  return { amount, detail: `${what} · total ${row.total}` };
}
