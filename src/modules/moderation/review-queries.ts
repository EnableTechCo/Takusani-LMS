import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/programmes/rules";

// Moderator and coordinator reads for sample item review (S4-07). The database decides what each person may see:
// a moderator reads only the items they hold, and never the evidence of work they assessed.

export async function listMyModerationCycles() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_moderation_cycles");
  if (error) throw new Error(`api.list_my_moderation_cycles failed: ${error.message}`);
  return data ?? [];
}

export async function listMySampleItems(cycleId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_sample_items", cycleId ? { p_cycle_id: cycleId } : {});
  if (error) throw new Error(`api.list_my_sample_items failed: ${error.message}`);
  return data ?? [];
}

/** Everything about one sampled item, or null when it is not the moderator's. Cached: the page and its title ask. */
export const openSampleItem = cache(async (itemId: string) => {
  if (!isUuid(itemId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("open_sample_item", { p_item_id: itemId });
  if (error) throw new Error(`api.open_sample_item failed: ${error.message}`);
  return data?.[0] ?? null;
});

export async function listModerationObservations(cycleId: string) {
  if (!isUuid(cycleId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_moderation_observations", { p_cycle_id: cycleId });
  if (error) throw new Error(`api.list_moderation_observations failed: ${error.message}`);
  return data ?? [];
}

/** C-07: every item of a cycle with who holds it. */
export async function listCycleSampleItems(cycleId: string) {
  if (!isUuid(cycleId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_cycle_sample_items", { p_cycle_id: cycleId });
  if (error) throw new Error(`api.list_cycle_sample_items failed: ${error.message}`);
  return data ?? [];
}

export async function listSampleModeratorCandidates(itemId: string) {
  if (!isUuid(itemId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_sample_moderator_candidates", { p_item_id: itemId });
  if (error) throw new Error(`api.list_sample_moderator_candidates failed: ${error.message}`);
  return data ?? [];
}
