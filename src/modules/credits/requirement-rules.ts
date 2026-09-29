/**
 * Unit credit requirements (S6-01; FR-801 to FR-804; ADR-022; P-07): which assessments each unit needs, the versions,
 * the refusals and the reconciliation differences, in words. The database decides; these only describe.
 */

export interface RequirementUnit {
  unit_id: string;
  code: string;
  title: string;
  qualification_title: string;
  credits: number | null;
  awarded_learners: number;
}

export interface RequirementItem {
  item_id: string;
  title: string;
  kind: string;
  suggested_unit_id: string | null;
}

export interface RequirementPair {
  unit_id: string;
  assessable_item_id: string;
}

export interface RequirementSet {
  requirement_set_id: string;
  version: number;
  frozen_at: string | null;
  frozen_by_name: string | null;
  created_by_name: string | null;
  updated_at: string;
  reason: string | null;
  in_force: boolean;
  awards: number;
  requirements: RequirementPair[];
}

export const REQUIREMENT_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  not_found: "This cohort is not one you coordinate.",
  cohort_archived: "This cohort is archived, so its requirements cannot change.",
  invalid_requirements: "The requirements could not be read. Reload the page and choose again.",
  unit_not_in_programme: "A unit you chose is not part of this cohort's programme. Reload the page and choose again.",
  item_not_in_cohort: "An assessment you chose is not one of this cohort's. Reload the page and choose again.",
  no_draft: "There is no draft to freeze or discard. Save the requirements as a draft first.",
  stale_draft:
    "The draft was saved again while you had this page open. Nothing was frozen: check the draft below and freeze it again.",
  no_requirements: "The draft requires nothing. Choose at least one assessment for a unit before freezing it.",
  credit_value_missing: "A unit in the draft has no credit value in force, so its award would have no value.",
  reason_required: "Say why the requirements are changing. It is kept with the version and in the audit log.",
  reason_too_long: "The reason is longer than 1,000 characters. Shorten it.",
  error: "The requirements could not be saved. Try again.",
};

/** The checkbox name for one unit and assessment: "req:<unit>:<item>". */
export function pairName(unitId: string, itemId: string): string {
  return `req:${unitId}:${itemId}`;
}

/** The pairs a submitted draft form chose. */
export function pairsFromForm(names: Iterable<string>): RequirementPair[] {
  const pairs: RequirementPair[] = [];
  for (const name of names) {
    const [prefix, unitId, itemId] = name.split(":");
    if (prefix === "req" && unitId && itemId) pairs.push({ unit_id: unitId, assessable_item_id: itemId });
  }
  return pairs;
}

/**
 * What the draft form starts from: the draft if there is one; otherwise the version in force; otherwise each
 * assessment under the unit its module belongs to.
 */
export function startingPairs(sets: RequirementSet[], items: RequirementItem[]): RequirementPair[] {
  const draft = sets.find((set) => set.frozen_at === null);
  if (draft) return draft.requirements;
  const inForce = sets.find((set) => set.in_force);
  if (inForce) return inForce.requirements;
  return items
    .filter((item) => item.suggested_unit_id !== null)
    .map((item) => ({ unit_id: item.suggested_unit_id!, assessable_item_id: item.item_id }));
}

/** The assessments a set requires for a unit, by title. */
export function requiredTitles(set: RequirementSet, unitId: string, items: RequirementItem[]): string[] {
  const titles = new Map(items.map((item) => [item.item_id, item.title]));
  return set.requirements
    .filter((pair) => pair.unit_id === unitId)
    .map((pair) => titles.get(pair.assessable_item_id) ?? "An assessment")
    .sort((a, b) => a.localeCompare(b));
}

/** "Needs Task 3 and Task 4 released Competent." / "Not awarded from this cohort: requires nothing." */
export function requirementText(titles: string[]): string {
  if (titles.length === 0) return "Requires nothing in this version, so it is not awarded from this cohort.";
  const list = titles.length === 1 ? titles[0] : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  return `Needs ${list} released Competent.`;
}

/** The changes between the version in force and the draft, for the freeze dialog. */
export function draftChanges(
  inForce: RequirementSet | undefined,
  draft: RequirementSet,
): { added: number; removed: number } {
  const key = (pair: RequirementPair) => `${pair.unit_id}:${pair.assessable_item_id}`;
  const before = new Set((inForce?.requirements ?? []).map(key));
  const after = new Set(draft.requirements.map(key));
  let added = 0;
  let removed = 0;
  for (const pair of after) if (!before.has(pair)) added += 1;
  for (const pair of before) if (!after.has(pair)) removed += 1;
  return { added, removed };
}

/** What freezing does, in the consequence dialog. */
export function freezeConsequence(version: number, changing: boolean): string {
  const evaluate =
    "Every learner with a result on these assessments is evaluated now: a unit whose required assessments are all released Competent is awarded its credits.";
  if (!changing) return `Version ${version} cannot be edited once frozen. ${evaluate}`;
  return `Version ${version} replaces the requirements in force and cannot be edited once frozen. ${evaluate} Awards already made stand: they rest on the version they were made under.`;
}

/** Freeze succeeded: "Version 2 is in force. 3 units were awarded to learners who already met them." */
export function frozenText(version: number, awarded: number): string {
  const awards =
    awarded === 0
      ? "The freeze awarded nothing new; credits are awarded as results are released."
      : `${awarded} ${awarded === 1 ? "unit was" : "units were"} awarded to learners who already met ${awarded === 1 ? "it" : "them"}.`;
  return `Version ${version} is in force. ${awards}`;
}

export const RECONCILIATION_KIND_TEXT: Record<string, string> = {
  ledger_total: "The ledger total differs from the award in force.",
  ledger_sequence: "The ledger's last entry does not match the learner's unit outcome.",
  award_not_met: "Awarded, but the requirements it was made under are no longer met.",
  met_not_awarded: "The requirements in force are met, but no award was made.",
};
