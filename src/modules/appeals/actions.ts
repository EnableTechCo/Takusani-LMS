"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { ADMISSIBILITY_REFUSALS, ALLOCATION_REFUSALS, APPEAL_REFUSALS, groundsError } from "./rules";

// Lodging an appeal (S3-01, FR-601 to FR-604). The database checks the window under a lock on the result, the one-remark
// rule and the grounds; the same client_appeal_id makes a retry return the appeal already lodged.

export interface LodgeState extends FormState {
  /** An open appeal of the same kind, or the admitted remark, to link to. */
  existing?: { id: string; reference: string };
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function lodgeAppeal(resultId: string, _: LodgeState, form: FormData): Promise<LodgeState> {
  const values = { type: text(form, "type"), grounds: text(form, "grounds") };
  const clientAppealId = text(form, "clientAppealId");
  const errors: Record<string, string> = {};
  if (values.type !== "view_script" && values.type !== "remark") errors.type = APPEAL_REFUSALS.invalid_type;
  const grounds = groundsError(values.grounds);
  if (grounds) errors.grounds = grounds;
  if (Object.keys(errors).length > 0) return { errors, values };
  if (!z.string().uuid().safeParse(clientAppealId).success) return { message: APPEAL_REFUSALS.error, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lodge_appeal", {
    p_result_id: resultId,
    p_type: values.type,
    p_grounds: values.grounds,
    p_client_appeal_id: clientAppealId,
  });
  const row = data?.[0];
  if (error || !row || row.status !== "ok") {
    const status = row?.status ?? "error";
    const message = APPEAL_REFUSALS[status] ?? APPEAL_REFUSALS.error;
    if (status === "invalid_type") return { errors: { type: message }, values };
    if (status.startsWith("grounds_")) return { errors: { grounds: message }, values };
    const existing =
      (status === "already_open" || status === "remark_used") && row?.appeal_id && row.reference
        ? { id: row.appeal_id, reference: row.reference }
        : undefined;
    return { message, values, existing };
  }
  revalidatePath(`/learn/results/${resultId}`);
  revalidatePath("/learn/appeals");
  redirect(`/learn/appeals/${row.appeal_id}?lodged=1`);
}

// Appeals administration (S3-02, FR-605, FR-608). The database checks the coordinator's scope, decides admissibility
// once, and re-checks separation of duties under a lock when a reviewer is allocated.

export async function decideAdmissibility(appealId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { decision: text(form, "decision"), reason: text(form, "reason") };
  const errors: Record<string, string> = {};
  if (values.decision !== "admit" && values.decision !== "inadmissible") {
    errors.decision = "Choose whether this appeal can be accepted.";
  } else if (values.decision === "inadmissible" && !values.reason) {
    errors.reason = ADMISSIBILITY_REFUSALS.reason_required;
  }
  if (Object.keys(errors).length > 0) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_appeal_admissibility", {
    p_appeal_id: appealId,
    p_admit: values.decision === "admit",
    p_reason: values.decision === "inadmissible" ? values.reason : undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = ADMISSIBILITY_REFUSALS[status] ?? ADMISSIBILITY_REFUSALS.error;
    if (status === "reason_required" || status === "reason_too_long") return { errors: { reason: message }, values };
    if (status === "already_decided") revalidatePath(`/coordinate/appeals/${appealId}`);
    return { message, values };
  }
  revalidatePath("/coordinate/appeals");
  redirect(`/coordinate/appeals/${appealId}?decided=${values.decision}`);
}

export interface ConflictDecision {
  decision_id: string;
  decided_at: string;
  outcome: string;
  version_number: number | null;
  role: string;
}

export interface AllocateState extends FormState {
  /** separation_of_duties_conflict: the decisions that exclude the person chosen, and who they were. */
  conflict?: { reviewerName: string; decisions: ConflictDecision[] };
}

export async function allocateReviewer(appealId: string, _: AllocateState, form: FormData): Promise<AllocateState> {
  const values = {
    reviewerId: text(form, "reviewerId"),
    reviewerName: text(form, "reviewerName"),
    skipReason: text(form, "skipReason"),
  };
  if (!z.string().uuid().safeParse(values.reviewerId).success) {
    return { errors: { reviewerId: ALLOCATION_REFUSALS.invalid_reviewer }, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("allocate_appeal_reviewer", {
    p_appeal_id: appealId,
    p_reviewer_id: values.reviewerId,
    p_skip_reason: values.skipReason || undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status === "separation_of_duties_conflict") {
    // The list on screen was out of date: reload it, and name the conflict (UX flow F, E1).
    revalidatePath(`/coordinate/appeals/${appealId}`);
    return {
      conflict: {
        reviewerName: values.reviewerName,
        decisions: (row?.conflicts ?? []) as unknown as ConflictDecision[],
      },
    };
  }
  if (status !== "ok") {
    const message = ALLOCATION_REFUSALS[status] ?? ALLOCATION_REFUSALS.error;
    if (status === "skip_reason_required") return { errors: { skipReason: message }, values };
    return { message, values };
  }
  revalidatePath("/coordinate/appeals");
  redirect(`/coordinate/appeals/${appealId}?allocated=1`);
}
