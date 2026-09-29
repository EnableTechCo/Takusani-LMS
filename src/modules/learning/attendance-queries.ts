import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Attendance reads (FR-209). The database scopes each: the learner's own record; a cohort's attendance for whoever
// sets work in it or coordinates it.

/** L-20: every session of the learner's cohorts that has started, latest first, with their check-in and mark. */
export const listMyAttendance = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_attendance");
  if (error) throw new Error(`api.list_my_attendance failed: ${error.message}`);
  return data;
});

/** F-12, C-15: each learner's confirmed marks across the cohort's sessions, lowest attendance first. */
export async function getCohortAttendance(cohortId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_cohort_attendance", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.get_cohort_attendance failed: ${error.message}`);
  return data;
}

/** F-12, C-15: the cohort's sessions that have started, latest first, each with its register's state and counts. */
export async function listCohortRegisters(cohortId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_cohort_registers", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.list_cohort_registers failed: ${error.message}`);
  return data;
}
