"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { CORRECTION_REFUSALS } from "./correction-rules";

// Corrections under dual control (C-14; P-12). The database decides who may propose and who may approve, checks
// independence under the result lock, and releases the corrected outcome; these carry the forms.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

const FIELD_OF: Record<string, string> = {
  invalid_outcome: "outcome",
  unchanged: "outcome",
  justification_required: "justification",
  justification_too_long: "justification",
  reason_required: "reason",
  reason_too_long: "reason",
  remediation_required: "remediation",
  resubmission_days_required: "resubmissionDays",
};

/** A coordinator proposes a correction of a released result; the page moves to the proposal. */
export async function proposeCorrection(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    resultId: text(form, "resultId"),
    outcome: text(form, "outcome"),
    justification: text(form, "justification"),
    reason: text(form, "reason"),
    remediation: text(form, "remediation"),
    resubmissionDays: text(form, "resubmissionDays"),
  };
  if (!values.resultId) return { errors: { resultId: "Choose the result to correct." }, values };
  const supabase = await createClient();
  const nyc = values.outcome === "not_yet_competent";
  const { data, error } = await supabase.rpc("propose_correction", {
    p_result_id: values.resultId,
    p_outcome: values.outcome,
    p_justification: values.justification,
    p_reason: values.reason,
    p_remediation: nyc ? values.remediation : undefined,
    p_resubmission_days: nyc && values.resubmissionDays ? Number(values.resubmissionDays) : undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    const message = CORRECTION_REFUSALS[status] ?? CORRECTION_REFUSALS.error;
    const field = FIELD_OF[status];
    return field ? { errors: { [field]: message }, values } : { message, values };
  }
  revalidatePath("/coordinate/corrections");
  redirect(`/coordinate/corrections/${row!.correction_id}?proposed=1`);
}

/** A second authorised person approves or declines; approval releases the corrected outcome at once. */
export async function concludeCorrection(
  base: string,
  correctionId: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const decision = text(form, "decision");
  const reason = text(form, "reason");
  if (decision !== "approve" && decision !== "decline") return { errors: { decision: "Choose approve or decline." } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("conclude_correction", {
    p_correction_id: correctionId,
    p_approve: decision === "approve",
    p_reason: reason || undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = CORRECTION_REFUSALS[status] ?? CORRECTION_REFUSALS.error;
    return status === "reason_required" || status === "reason_too_long"
      ? { errors: { reason: message }, values: { decision, reason } }
      : { message, values: { decision, reason } };
  }
  revalidatePath(base);
  revalidatePath(`${base}/${correctionId}`);
  redirect(`${base}/${correctionId}?concluded=${decision}`);
}

/** The proposer withdraws an open proposal. */
export async function withdrawCorrection(correctionId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_correction", { p_correction_id: correctionId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return { message: CORRECTION_REFUSALS[status] ?? CORRECTION_REFUSALS.error };
  revalidatePath("/coordinate/corrections");
  redirect(`/coordinate/corrections/${correctionId}?concluded=withdrawn`);
}
