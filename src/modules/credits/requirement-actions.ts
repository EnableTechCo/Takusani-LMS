"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { REQUIREMENT_REFUSALS, pairsFromForm } from "./requirement-rules";

// Unit credit requirements (S6-01; P-07). The database checks the coordinator, the units and assessments, freezes the
// draft and evaluates every learner; these carry the forms.

const page = (cohortId: string) => `/coordinate/cohorts/${cohortId}/credits`;

function refused(status: string, values?: Record<string, string>): FormState {
  return { message: REQUIREMENT_REFUSALS[status] ?? REQUIREMENT_REFUSALS.error, values };
}

/** Saves the ticked units and assessments as the cohort's draft. */
export async function saveRequirementDraft(cohortId: string, _: FormState, form: FormData): Promise<FormState> {
  const pairs = pairsFromForm(form.keys());
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_requirement_draft", {
    p_cohort_id: cohortId,
    p_requirements: pairs.map((pair) => ({ unit_id: pair.unit_id, assessable_item_id: pair.assessable_item_id })),
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status);
  revalidatePath(page(cohortId));
  redirect(`${page(cohortId)}?saved=1#draft`);
}

/** Freezes the draft the page showed; a later version carries its reason. */
export async function freezeRequirementSet(
  cohortId: string,
  requirementSetId: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const reason = String(form.get("reason") ?? "").trim();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("freeze_requirement_set", {
    p_cohort_id: cohortId,
    p_requirement_set_id: requirementSetId,
    // An empty reason reads as none: the database refuses it for a change to the version in force.
    p_reason: reason,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    if (status === "reason_required" || status === "reason_too_long")
      return { errors: { reason: REQUIREMENT_REFUSALS[status] }, values: { reason } };
    if (status === "credit_value_missing")
      return {
        message: `${REQUIREMENT_REFUSALS.credit_value_missing} ${row?.missing?.length === 1 ? "Unit" : "Units"} ${(row?.missing ?? []).join(", ")}: an administrator sets the value under Configuration.`,
        values: { reason },
      };
    return refused(status, { reason });
  }
  revalidatePath(page(cohortId));
  revalidatePath(`/coordinate/cohorts/${cohortId}/readiness`);
  redirect(`${page(cohortId)}?frozen=${row!.version}&awarded=${row!.awarded ?? 0}`);
}

/** Discards the cohort's draft. */
export async function discardRequirementDraft(cohortId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("discard_requirement_draft", { p_cohort_id: cohortId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return refused(status);
  revalidatePath(page(cohortId));
  redirect(`${page(cohortId)}?discarded=1`);
}
