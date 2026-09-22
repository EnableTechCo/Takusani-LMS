"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, type FormState } from "@/lib/form-state";
import { enrolSchema, newCohortSchema, newProgrammeSchema, PROGRAMME_REFUSALS } from "./rules";

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

/** Maps a refusal status to the field it belongs to, or to the whole form. */
function refused(status: string, values: Record<string, string>): FormState {
  const refusal = PROGRAMME_REFUSALS[status] ?? { message: "That could not be saved. Try again." };
  return refusal.field
    ? { errors: { [refusal.field]: refusal.message }, values }
    : { message: refusal.message, values };
}

export async function createProgramme(_: FormState, form: FormData): Promise<FormState> {
  const values = { code: text(form, "code"), title: text(form, "title"), nqfLevel: text(form, "nqfLevel") };
  const parsed = newProgrammeSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_programme", {
    p_code: parsed.data.code,
    p_title: parsed.data.title,
    p_nqf_level: parsed.data.nqfLevel,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);

  redirect(`/coordinate/cohorts/new?programme=${data![0].programme_id}`);
}

export async function createCohort(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    programmeId: text(form, "programmeId"),
    name: text(form, "name"),
    startsOn: text(form, "startsOn"),
    endsOn: text(form, "endsOn"),
  };
  const parsed = newCohortSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_cohort", {
    p_programme_id: parsed.data.programmeId,
    p_name: parsed.data.name,
    p_starts_on: parsed.data.startsOn,
    p_ends_on: parsed.data.endsOn,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);

  redirect(`/coordinate/cohorts/${data![0].cohort_id}`);
}

export async function enrolLearner(cohortId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = enrolSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("enrol_learner", { p_cohort_id: cohortId, p_email: parsed.data.email });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status, values);

  revalidatePath(`/coordinate/cohorts/${cohortId}/people`);
  return { done: true, message: `${parsed.data.email} is enrolled.` };
}
