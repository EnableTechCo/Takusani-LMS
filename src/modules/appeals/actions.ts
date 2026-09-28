"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { APPEAL_REFUSALS, groundsError } from "./rules";

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
