import { formatDayOf } from "@/lib/dates";

/**
 * Where an assessor's decisions stand (A-03, FR-409; UX spec 7.3 and 7.4). Staff always see "decided" and "released"
 * as two facts with two dates. "Sampled" and "returned to you" come with the moderation cycle (S4-05 to S4-08); until
 * then a held decision is either waiting for a cycle or in one.
 */

export type ReleaseStage = "waiting_for_cycle" | "in_moderation" | "released" | "replaced";

export interface ReleaseRow {
  decision_id: string;
  instance_id: string | null;
  result_id: string;
  cohort_id: string;
  cohort_name: string;
  moderation_policy: string;
  item_id: string;
  item_title: string;
  learner_name: string;
  learner_number: string | null;
  outcome: string;
  decided_at: string;
  stage: ReleaseStage;
  released_at: string | null;
  replaced_by: string | null;
  replaced_at: string | null;
}

const REPLACED_BY: Record<string, string> = {
  assessment: "Replaced by a later decision",
  moderation: "Replaced after moderation",
  appeal: "Replaced on appeal",
  correction: "Corrected",
};

export function isHeld(row: Pick<ReleaseRow, "stage">): boolean {
  return row.stage === "waiting_for_cycle" || row.stage === "in_moderation";
}

/** Where the decision stands, in the words of UX spec 7.3 and 7.4. */
export function stageText(row: Pick<ReleaseRow, "stage" | "released_at" | "replaced_by" | "replaced_at">): string {
  switch (row.stage) {
    case "waiting_for_cycle":
      return "Held: waiting for a moderation cycle";
    case "in_moderation":
      return "Held: in moderation";
    case "released":
      return row.released_at ? `Released ${formatDayOf(row.released_at)}` : "Released";
    case "replaced": {
      const words = REPLACED_BY[row.replaced_by ?? ""] ?? "Replaced";
      return row.replaced_at ? `${words} ${formatDayOf(row.replaced_at)}` : words;
    }
  }
}

/** "Decided 10 Sep 2026. Released 22 Sep 2026.", or "Decided 10 Sep 2026. Not released." */
export function decidedAndReleased(decidedAt: string, releasedAt: string | null): string {
  return `Decided ${formatDayOf(decidedAt)}. ${releasedAt ? `Released ${formatDayOf(releasedAt)}.` : "Not released."}`;
}

export interface ItemSummary {
  itemId: string;
  itemTitle: string;
  decided: number;
  waiting: number;
  inModeration: number;
  released: number;
  lastReleasedAt: string | null;
}

export interface CohortSummary {
  cohortId: string;
  cohortName: string;
  moderated: boolean;
  decided: number;
  held: number;
  released: number;
  items: ItemSummary[];
}

/**
 * Per cohort and item: how many of this assessor's decisions are waiting for a cycle, in moderation, and released,
 * and when the item last had a release. A replaced decision counts as decided only: the one that replaced it is
 * where the result stands. Cohorts with something held come first, then by name; items by title.
 */
export function summarise(rows: ReleaseRow[]): CohortSummary[] {
  const cohorts = new Map<string, CohortSummary>();
  const items = new Map<string, ItemSummary>();
  for (const row of rows) {
    let cohort = cohorts.get(row.cohort_id);
    if (!cohort) {
      cohort = {
        cohortId: row.cohort_id,
        cohortName: row.cohort_name,
        moderated: row.moderation_policy === "moderated",
        decided: 0,
        held: 0,
        released: 0,
        items: [],
      };
      cohorts.set(row.cohort_id, cohort);
    }
    let item = items.get(row.item_id);
    if (!item) {
      item = {
        itemId: row.item_id,
        itemTitle: row.item_title,
        decided: 0,
        waiting: 0,
        inModeration: 0,
        released: 0,
        lastReleasedAt: null,
      };
      items.set(row.item_id, item);
      cohort.items.push(item);
    }
    item.decided += 1;
    cohort.decided += 1;
    if (row.stage === "waiting_for_cycle") item.waiting += 1;
    if (row.stage === "in_moderation") item.inModeration += 1;
    if (isHeld(row)) cohort.held += 1;
    if (row.stage === "released") {
      item.released += 1;
      cohort.released += 1;
    }
    if (row.released_at && (!item.lastReleasedAt || row.released_at > item.lastReleasedAt)) {
      item.lastReleasedAt = row.released_at;
    }
  }
  for (const cohort of cohorts.values()) cohort.items.sort((a, b) => a.itemTitle.localeCompare(b.itemTitle));
  return [...cohorts.values()].sort(
    (a, b) => Number(b.held > 0) - Number(a.held > 0) || a.cohortName.localeCompare(b.cohortName),
  );
}
