import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/programmes/rules";

// Corrections (C-14; P-12). The database scopes each read to the cohorts the signed-in person coordinates, or to
// every cohort for an administrator.

export async function listCorrections() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_corrections");
  if (error) throw new Error(`api.list_corrections failed: ${error.message}`);
  return data ?? [];
}

export async function listCorrectableResults(cohortId: string) {
  if (!isUuid(cohortId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_correctable_results", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.list_correctable_results failed: ${error.message}`);
  return data ?? [];
}

export async function getCorrection(correctionId: string) {
  if (!isUuid(correctionId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_correction", { p_correction_id: correctionId });
  if (error) throw new Error(`api.get_correction failed: ${error.message}`);
  return data?.[0] ?? null;
}

/**
 * L-15: when the learner's current decision is a correction, when it was made and who assessed the work (the
 * correction's actor is the approver, not the assessor); otherwise null.
 */
export async function getMyResultCorrection(
  resultId: string,
): Promise<{ correctedAt: string; assessorName: string | null } | null> {
  if (!isUuid(resultId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_result_correction", { p_result_id: resultId });
  if (error) throw new Error(`api.get_my_result_correction failed: ${error.message}`);
  const row = data?.[0];
  return row ? { correctedAt: row.corrected_at, assessorName: row.assessor_name ?? null } : null;
}
