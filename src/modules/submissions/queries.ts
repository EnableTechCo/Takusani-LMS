import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "./rules";

// Each query answers for the signed-in person only: the database decides which cohorts they set work in, and a
// learner sees published tasks they are the audience for and nothing else.

export async function listTasks(cohortId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_tasks", { p_cohort_id: cohortId ?? undefined });
  if (error) throw new Error(`api.list_tasks failed: ${error.message}`);
  return data;
}

/** One task with its rubric and named learners, or null when it does not exist or is outside the person's scope. */
export async function getTask(taskId: string) {
  if (!isUuid(taskId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_task", { p_task_id: taskId });
  if (error) throw new Error(`api.get_task failed: ${error.message}`);
  return data?.[0] ?? null;
}

/** The cohorts this person may set work in. */
export async function listWorkCohorts() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_work_cohorts");
  if (error) throw new Error(`api.list_work_cohorts failed: ${error.message}`);
  return data;
}

/** One task as its learner sees it: the brief, what to hand in, and every version they have submitted. */
export async function getMyTask(taskId: string) {
  if (!isUuid(taskId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_task", { p_task_id: taskId });
  if (error) throw new Error(`api.get_my_task failed: ${error.message}`);
  return data?.[0] ?? null;
}

/** The learner's own published tasks (FR-202: a draft never appears here). */
export async function listMyTasks() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_tasks");
  if (error) throw new Error(`api.list_my_tasks failed: ${error.message}`);
  return data;
}
