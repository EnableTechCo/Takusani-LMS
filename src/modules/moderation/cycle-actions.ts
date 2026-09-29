"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { instantFromSast } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { MODERATION_REFUSALS } from "./cycle-rules";

// Coordinator commands for moderation cycles (S4-05; FR-501, FR-506). The database checks scope, the policy and the
// one-open-cycle-per-item rule, and audits; these carry the form and say what a refusal means. A scope overlap comes
// back with the item and the cycle it is in, so the form can show the conflict and offer to take the item out.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const list = (form: FormData, name: string) => form.getAll(name).map(String).filter(Boolean);

const FIELD_OF: Record<string, string> = {
  invalid_name: "name",
  unknown_item: "items",
  unknown_unit: "units",
  empty_scope: "items",
  invalid_period: "periodTo",
  start_in_past: "startsAt",
};

/** C-06: plans a cycle for the cohort; the page reloads with it in the list. */
export async function planCycle(cohortId: string, _: FormState, form: FormData): Promise<FormState> {
  const scopeBy = text(form, "scopeBy") === "units" ? "units" : "items";
  const items = scopeBy === "items" ? list(form, "items") : [];
  const units = scopeBy === "units" ? list(form, "units") : [];
  const start = text(form, "start") === "scheduled" ? "scheduled" : "manual";
  const values: Record<string, string> = {
    name: text(form, "name"),
    scopeBy,
    items: items.join(","),
    units: units.join(","),
    periodFrom: text(form, "periodFrom"),
    periodTo: text(form, "periodTo"),
    start,
    startsAt: text(form, "startsAt"),
  };
  const errors: Record<string, string> = {};
  if (!values.name) errors.name = MODERATION_REFUSALS.invalid_name;
  if (items.length === 0 && units.length === 0) errors[scopeBy] = MODERATION_REFUSALS.empty_scope;
  if (start === "scheduled" && !values.startsAt) errors.startsAt = "Choose the date and time the cycle freezes.";
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("plan_moderation_cycle", {
    p_cohort_id: cohortId,
    p_name: values.name,
    p_item_ids: items,
    p_unit_ids: units,
    p_period_from: values.periodFrom || undefined,
    p_period_to: values.periodTo || undefined,
    p_scheduled_start_at: start === "scheduled" ? instantFromSast(values.startsAt) : undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status === "scope_overlap" && row) {
    return {
      message: `The cycle was not planned: ${row.conflict_item_title} is already in a cycle that is not finished.`,
      values: {
        ...values,
        conflictItemId: row.conflict_item_id ?? "",
        conflictItemTitle: row.conflict_item_title ?? "",
        conflictCycleId: row.conflict_cycle_id ?? "",
        conflictCycleName: row.conflict_cycle_name ?? "",
        conflictCycleState: row.conflict_cycle_state ?? "",
      },
    };
  }
  if (status !== "ok") {
    const message = MODERATION_REFUSALS[status] ?? MODERATION_REFUSALS.error;
    const field = FIELD_OF[status];
    return field ? { errors: { [field]: message }, values } : { message, values };
  }
  revalidatePath(`/coordinate/cohorts/${cohortId}/moderation`);
  redirect(`/coordinate/cohorts/${cohortId}/moderation?planned=${row!.cycle_id}`);
}

/** Cancels a planned cycle, with the reason kept; the results it would have claimed stay waiting. */
export async function cancelCycle(
  cohortId: string,
  cycleId: string,
  version: number,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const reason = text(form, "reason");
  if (!reason) return { errors: { reason: MODERATION_REFUSALS.reason_required } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_moderation_cycle", {
    p_cycle_id: cycleId,
    p_expected_version: version,
    p_reason: reason,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = MODERATION_REFUSALS[status] ?? MODERATION_REFUSALS.error;
    return status === "reason_required" ? { errors: { reason: message } } : { message };
  }
  revalidatePath(`/coordinate/cohorts/${cohortId}/moderation`);
  redirect(`/coordinate/cohorts/${cohortId}/moderation?cancelled=${cycleId}`);
}
