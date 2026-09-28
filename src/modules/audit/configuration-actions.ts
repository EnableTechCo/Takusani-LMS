"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { CONFIG_REFUSALS } from "./configuration-rules";

// Versioned configuration (S3-09). The database checks the administrator and the value, computes the previous value,
// and records a new version; nothing is ever edited.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const FIELD_OF: Record<string, string> = {
  invalid_value: "value",
  invalid_date: "effectiveOn",
  reason_required: "reason",
  reason_too_long: "reason",
  unchanged: "value",
};

export async function recordVersion(key: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { value: text(form, "value"), effectiveOn: text(form, "effectiveOn"), reason: text(form, "reason") };
  const errors: Record<string, string> = {};
  if (!values.value) errors.value = CONFIG_REFUSALS.invalid_value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.effectiveOn)) errors.effectiveOn = CONFIG_REFUSALS.invalid_date;
  if (!values.reason) errors.reason = CONFIG_REFUSALS.reason_required;
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_configuration_version", {
    p_key: key,
    p_value: values.value,
    p_effective_on: values.effectiveOn,
    p_reason: values.reason,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    const message = CONFIG_REFUSALS[status] ?? CONFIG_REFUSALS.error;
    return FIELD_OF[status] ? { errors: { [FIELD_OF[status]]: message }, values } : { message, values };
  }
  revalidatePath("/admin/configuration");
  redirect(`/admin/configuration/${key}?recorded=${row!.version}`);
}

export async function cancelVersion(key: string, version: number, form: FormData): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_configuration_version", {
    p_key: key,
    p_version: version,
    p_reason: text(form, "reason") || "Cancelled before it took effect.",
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  revalidatePath("/admin/configuration");
  redirect(`/admin/configuration/${key}?cancel=${status}`);
}

export async function setUnitCredits(unitId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { value: text(form, "value"), effectiveOn: text(form, "effectiveOn"), reason: text(form, "reason") };
  const errors: Record<string, string> = {};
  if (!/^\d{1,4}$/.test(values.value)) errors.value = "Enter a whole number of credits from 0 to 1000.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.effectiveOn)) errors.effectiveOn = CONFIG_REFUSALS.invalid_date;
  if (!values.reason) errors.reason = CONFIG_REFUSALS.reason_required;
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_unit_credit_value", {
    p_unit_id: unitId,
    p_credits: Number(values.value),
    p_effective_on: values.effectiveOn,
    p_reason: values.reason,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message =
      status === "invalid_value"
        ? "Enter a whole number of credits from 0 to 1000."
        : (CONFIG_REFUSALS[status] ?? CONFIG_REFUSALS.error);
    return FIELD_OF[status] ? { errors: { [FIELD_OF[status]]: message }, values } : { message, values };
  }
  revalidatePath("/admin/configuration");
  redirect(`/admin/configuration/units/${unitId}?recorded=1`);
}
