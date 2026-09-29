import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/programmes/rules";
import type { CycleRow, PoolRow, PoolSummary } from "./cycle-rules";

// Moderation planning reads (C-06). Each answers only for cohorts the signed-in coordinator covers; the database
// decides, and returns nothing for anyone else.

export async function listModerationCycles(cohortId: string): Promise<CycleRow[]> {
  if (!isUuid(cohortId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_moderation_cycles", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.list_moderation_cycles failed: ${error.message}`);
  return (data ?? []) as unknown as CycleRow[];
}

/** Every assessable item of the cohort, with its waiting, held and released results and the cycle covering it. */
export async function getModerationPool(cohortId: string): Promise<PoolRow[]> {
  if (!isUuid(cohortId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_moderation_pool", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.get_moderation_pool failed: ${error.message}`);
  return (data ?? []) as unknown as PoolRow[];
}

/** The figures at the top of the page and the settings in force, or null outside the coordinator's scope. */
export async function getModerationSummary(cohortId: string): Promise<PoolSummary | null> {
  if (!isUuid(cohortId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_moderation_summary", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.get_moderation_summary failed: ${error.message}`);
  return (data?.[0] as unknown as PoolSummary | undefined) ?? null;
}
