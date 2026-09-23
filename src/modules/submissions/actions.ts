"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { instantFromSast } from "@/lib/dates";
import { fieldErrors, type FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import {
  audienceSchema,
  criteriaSchema,
  editTaskSchema,
  newTaskSchema,
  requirementsSchema,
  TASK_REFUSALS,
} from "./rules";

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

/** Maps a refusal status to the field it belongs to, or to the whole form. */
function refused(status: string, values: Record<string, string>): FormState {
  const refusal = TASK_REFUSALS[status] ?? { message: "That could not be saved. Try again." };
  return refusal.field
    ? { errors: { [refusal.field]: refusal.message }, values }
    : { message: refusal.message, values };
}

function taskFields(form: FormData) {
  return {
    title: text(form, "title"),
    brief: text(form, "brief"),
    submissionType: text(form, "submissionType"),
    dueAt: text(form, "dueAt"),
    latePolicy: text(form, "latePolicy"),
  };
}

export async function createTask(_: FormState, form: FormData): Promise<FormState> {
  const values = { cohortId: text(form, "cohortId"), ...taskFields(form) };
  const parsed = newTaskSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_task", {
    p_cohort_id: parsed.data.cohortId,
    p_title: parsed.data.title,
    p_brief: parsed.data.brief,
    p_submission_type: parsed.data.submissionType,
    p_due_at: parsed.data.dueAt ? instantFromSast(parsed.data.dueAt) : undefined,
    p_late_policy: parsed.data.latePolicy,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);

  redirect(`/teach/tasks/${data![0].task_id}/edit`);
}

export async function updateTask(taskId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = taskFields(form);
  const parsed = editTaskSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_task", {
    p_task_id: taskId,
    p_title: parsed.data.title,
    p_brief: parsed.data.brief,
    p_submission_type: parsed.data.submissionType,
    p_due_at: parsed.data.dueAt ? instantFromSast(parsed.data.dueAt) : undefined,
    p_late_policy: parsed.data.latePolicy,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);

  revalidatePath(`/teach/tasks/${taskId}/edit`);
  return { done: true, message: "The draft is saved." };
}

/** Replaces the rubric. The editor posts it as JSON, so the rows keep the order they are shown in. */
export async function setTaskCriteria(taskId: string, _: FormState, form: FormData): Promise<FormState> {
  const raw = text(form, "criteria");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw || "[]");
  } catch {
    return { errors: { criteria: TASK_REFUSALS.invalid_criteria.message } };
  }
  const parsed = criteriaSchema.safeParse(parsedJson);
  if (!parsed.success) return { errors: { criteria: parsed.error.issues[0]?.message ?? "Check the rubric." } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_task_criteria", {
    p_task_id: taskId,
    p_criteria: parsed.data.map((criterion) => ({
      title: criterion.title,
      descriptor: criterion.descriptor ?? null,
      points: criterion.points ?? null,
    })),
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, { criteria: raw });

  revalidatePath(`/teach/tasks/${taskId}/edit`);
  const count = data![0].criteria_count ?? 0;
  return { done: true, message: count === 1 ? "The rubric has 1 criterion." : `The rubric has ${count} criteria.` };
}

/** Replaces what the learner must hand in. Posted as JSON, like the rubric, so the order is kept. */
export async function setTaskRequirements(taskId: string, _: FormState, form: FormData): Promise<FormState> {
  const raw = text(form, "requirements");
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw || "[]");
  } catch {
    return { errors: { requirements: TASK_REFUSALS.invalid_requirements.message } };
  }
  const parsed = requirementsSchema.safeParse(parsedJson);
  if (!parsed.success) return { errors: { requirements: parsed.error.issues[0]?.message ?? "Check the list." } };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_task_requirements", {
    p_task_id: taskId,
    p_requirements: parsed.data.map((requirement) => ({
      title: requirement.title,
      guidance: requirement.guidance ?? null,
      mandatory: requirement.mandatory ?? true,
    })),
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, { requirements: raw });

  revalidatePath(`/teach/tasks/${taskId}/edit`);
  const count = data![0].requirement_count ?? 0;
  return {
    done: true,
    message:
      count === 0
        ? "This task asks for no files."
        : count === 1
          ? "The learner hands in 1 piece of evidence."
          : `The learner hands in ${count} pieces of evidence.`,
  };
}

export async function setTaskAudience(taskId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { audience: text(form, "audience"), emails: text(form, "emails") };
  const parsed = audienceSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_task_audience", {
    p_task_id: taskId,
    p_audience: parsed.data.audience,
    p_emails: parsed.data.emails,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);

  revalidatePath(`/teach/tasks/${taskId}/edit`);
  const size = data![0].audience_size ?? 0;
  return { done: true, message: size === 1 ? "The task is for 1 learner." : `The task is for ${size} learners.` };
}

/**
 * Publishing is the point of no return: from here learners see the task (FR-202). It takes no fields, so the form
 * state and data that useActionState passes are ignored.
 */
export async function publishTask(taskId: string, ...ignored: [FormState, FormData]): Promise<FormState> {
  void ignored;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_task", { p_task_id: taskId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, {});

  revalidatePath("/teach/tasks");
  redirect(`/teach/tasks/${taskId}/edit?published=${data![0].notified}`);
}
