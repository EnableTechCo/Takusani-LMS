"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { REVIEW_REFUSALS } from "./review-rules";

// Moderator and coordinator commands for sample items (S4-07). The database checks who holds the item and the
// separation-of-duties rule, keeps findings append-only and audits; these carry the forms.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

/** M-03: records a finding on an item the moderator holds; the page reloads on the item with it in the history. */
export async function recordFinding(cycleId: string, itemId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { finding: text(form, "finding"), reasons: text(form, "reasons") };
  const errors: Record<string, string> = {};
  if (!values.finding) errors.finding = REVIEW_REFUSALS.invalid_finding;
  if (!values.reasons) errors.reasons = REVIEW_REFUSALS.reasons_required;
  if (Object.keys(errors).length > 0) return { errors, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_moderation_finding", {
    p_item_id: itemId,
    p_finding: values.finding,
    p_reasons: values.reasons,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = REVIEW_REFUSALS[status] ?? REVIEW_REFUSALS.error;
    if (status === "invalid_finding") return { errors: { finding: message }, values };
    if (status === "reasons_required") return { errors: { reasons: message }, values };
    return { message, values };
  }
  revalidatePath(`/moderate/cycles/${cycleId}`);
  revalidatePath(`/moderate/cycles/${cycleId}/items/${itemId}`);
  redirect(`/moderate/cycles/${cycleId}/items/${itemId}?recorded=${values.finding}`);
}

/** M-02: adds a cohort-level observation to the cycle. */
export async function recordObservation(cycleId: string, _: FormState, form: FormData): Promise<FormState> {
  const body = text(form, "body");
  if (!body) return { errors: { body: REVIEW_REFUSALS.body_required } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_moderation_observation", { p_cycle_id: cycleId, p_body: body });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = REVIEW_REFUSALS[status] ?? REVIEW_REFUSALS.error;
    return status === "body_required" ? { errors: { body: message } } : { message };
  }
  revalidatePath(`/moderate/cycles/${cycleId}`);
  return { done: true };
}

/** C-07: moves an item to another moderator; a conflict comes back named for the page. */
export async function reallocateItem(
  cohortId: string,
  cycleId: string,
  itemId: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const moderatorId = text(form, "moderatorId");
  if (!moderatorId) return { errors: { moderatorId: REVIEW_REFUSALS.not_a_moderator } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reallocate_sample_item", {
    p_item_id: itemId,
    p_moderator_id: moderatorId,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    const message = REVIEW_REFUSALS[status] ?? REVIEW_REFUSALS.error;
    if (status === "separation_of_duties_conflict") {
      return { message, values: { moderatorId, conflict: JSON.stringify(row?.conflict ?? []) } };
    }
    return status === "not_a_moderator" || status === "unchanged"
      ? { errors: { moderatorId: message }, values: { moderatorId } }
      : { message, values: { moderatorId } };
  }
  revalidatePath(`/coordinate/cohorts/${cohortId}/moderation/cycles/${cycleId}`);
  redirect(`/coordinate/cohorts/${cohortId}/moderation/cycles/${cycleId}?reallocated=${itemId}`);
}
