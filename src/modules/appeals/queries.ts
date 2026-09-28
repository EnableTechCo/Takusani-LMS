import "server-only";
import { cache } from "react";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Appeals (S3-01). The database returns a learner only their own released results and appeals, and a coordinator only
// the appeals in cohorts they coordinate.

const isUuid = (value: string) => z.string().uuid().safeParse(value).success;

/** The lodge page's facts about one released result, or null when it is not the learner's or not released. */
export async function getAppealOptions(resultId: string) {
  if (!isUuid(resultId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_appeal_options", { p_result_id: resultId });
  if (error) throw new Error(`api.get_appeal_options failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function listMyAppeals() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_appeals");
  if (error) throw new Error(`api.list_my_appeals failed: ${error.message}`);
  return data;
}

export async function getMyAppeal(appealId: string) {
  if (!isUuid(appealId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_appeal", { p_appeal_id: appealId });
  if (error) throw new Error(`api.get_my_appeal failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function listAppealsToCoordinate() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_appeals_to_coordinate");
  if (error) throw new Error(`api.list_appeals_to_coordinate failed: ${error.message}`);
  return data;
}

export async function getAppealToCoordinate(appealId: string) {
  if (!isUuid(appealId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_appeal_to_coordinate", { p_appeal_id: appealId });
  if (error) throw new Error(`api.get_appeal_to_coordinate failed: ${error.message}`);
  return data?.[0] ?? null;
}

/** The reviewer list for a coordinator (AS-02): tiers first, then everyone excluded, each with the reason. */
export async function listAppealReviewerCandidates(appealId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_appeal_reviewer_candidates", { p_appeal_id: appealId });
  if (error) throw new Error(`api.list_appeal_reviewer_candidates failed: ${error.message}`);
  return data;
}

/**
 * The learner's marked work for a granted request (FR-606). Every call records an opening, so it is cached for the
 * request: the page and its title both ask, and one visit is one opening.
 */
export const viewMyMarkedWork = cache(async (appealId: string) => {
  if (!isUuid(appealId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("view_my_marked_work", { p_appeal_id: appealId });
  if (error) throw new Error(`api.view_my_marked_work failed: ${error.message}`);
  return data?.[0] ?? null;
});
