import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "./rules";

// Cohort setup (S4-03). Every read is scoped by the database to the cohorts the coordinator covers.

export async function getCohortSetup(cohortId: string) {
  if (!isUuid(cohortId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_cohort_setup", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.get_cohort_setup failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function listPolicyHistory(cohortId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_moderation_policy_history", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.list_moderation_policy_history failed: ${error.message}`);
  return data;
}

export async function getCohortReadiness(cohortId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_cohort_readiness", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.get_cohort_readiness failed: ${error.message}`);
  return data;
}

export async function listCohortStaff(cohortId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_cohort_staff", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.list_cohort_staff failed: ${error.message}`);
  return data;
}
