"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { SIGN_OFF_REFUSALS } from "./sign-off-rules";

/**
 * M-04 (FR-510, FR-511): signs off the cycle and releases its frozen population in one transaction. The database
 * decides eligibility (P-05) and what blocks it; a refusal after a race comes back with the blocking items, which
 * the page renders like its own list. A retry of a signed-off cycle is a success.
 */
export async function signOffCycle(cycleId: string, version: number, _: FormState, form: FormData): Promise<FormState> {
  const statement = String(form.get("statement") ?? "").trim();
  if (!statement) return { errors: { statement: SIGN_OFF_REFUSALS.statement_required } };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("sign_off_moderation_cycle", {
    p_cycle_id: cycleId,
    p_expected_version: version,
    p_statement: statement,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok" && status !== "already_signed_off") {
    const message = SIGN_OFF_REFUSALS[status] ?? SIGN_OFF_REFUSALS.error;
    if (status === "statement_required" || status === "statement_too_long") {
      return { errors: { statement: message }, values: { statement } };
    }
    return {
      message,
      values: { statement, blockers: status === "blocked" ? JSON.stringify(row?.details ?? []) : "" },
    };
  }
  revalidatePath("/moderate");
  revalidatePath(`/moderate/cycles/${cycleId}`);
  revalidatePath(`/moderate/cycles/${cycleId}/sign-off`);
  redirect(`/moderate/cycles/${cycleId}/sign-off?signed=1`);
}
