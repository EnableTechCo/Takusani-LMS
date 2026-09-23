import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "./rules";

// Each query returns only what the signed-in coordinator's role covers; the database applies the scope.

export async function listProgrammes() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_programmes");
  if (error) throw new Error(`api.list_programmes failed: ${error.message}`);
  return data;
}

export async function listCohorts() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_cohorts");
  if (error) throw new Error(`api.list_cohorts failed: ${error.message}`);
  return data;
}

/** One cohort, or null when it does not exist or the coordinator's scope does not cover it. */
export async function getCohort(cohortId: string) {
  if (!isUuid(cohortId)) return null;
  return (await listCohorts()).find((cohort) => cohort.id === cohortId) ?? null;
}

export async function listEnrolments(cohortId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_enrolments", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.list_enrolments failed: ${error.message}`);
  return data;
}

/** The signed-in learner's own active enrolments (learner home header and first-day welcome). */
export async function listMyEnrolments() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_enrolments");
  if (error) throw new Error(`api.list_my_enrolments failed: ${error.message}`);
  return data;
}
