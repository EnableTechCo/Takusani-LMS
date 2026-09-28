import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// The facilitator's submission dashboard (S2-16). The database answers only for cohorts they set work in.

const isUuid = (value: string) => z.string().uuid().safeParse(value).success;

export async function listTaskSubmissionCounts(cohortId: string) {
  if (!isUuid(cohortId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_task_submission_counts", { p_cohort_id: cohortId });
  if (error) throw new Error(`api.list_task_submission_counts failed: ${error.message}`);
  return data;
}

export async function listTaskSubmissions(taskId: string) {
  if (!isUuid(taskId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_task_submissions", { p_task_id: taskId });
  if (error) throw new Error(`api.list_task_submissions failed: ${error.message}`);
  return data;
}

export async function getLearnerSubmissionHistory(learnerId: string) {
  if (!isUuid(learnerId)) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_learner_submission_history", { p_learner_id: learnerId });
  if (error) throw new Error(`api.get_learner_submission_history failed: ${error.message}`);
  return data;
}
