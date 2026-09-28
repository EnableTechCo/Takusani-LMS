"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { marksFromForm, REGISTER_REFUSALS } from "./register-rules";

// The attendance register (S3-12, FR-209). The database decides everything: who is on the roster, that the first
// save marks everyone, that an amendment carries its reason, and that nobody saves over someone else's changes.

export async function saveRegister(sessionId: string, _: FormState, form: FormData): Promise<FormState> {
  const marks = marksFromForm([...form.entries()]);
  const reason = String(form.get("reason") ?? "").trim();
  const values: Record<string, string> = { reason };
  for (const mark of marks) values[`mark:${mark.learner_id}`] = mark.status;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_register", {
    p_session_id: sessionId,
    p_marks: marks,
    p_expected_version: Number(form.get("expectedVersion") ?? 0),
    p_reason: reason || undefined,
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    const message = REGISTER_REFUSALS[status] ?? REGISTER_REFUSALS.error;
    if (status === "reason_required" || status === "reason_too_long") return { errors: { reason: message }, values };
    // A stale save starts again from what is saved now, so the facilitator sees the other person's marks.
    if (status === "stale") revalidatePath(`/teach/sessions/${sessionId}/register`);
    return { message, values: status === "stale" ? { reason } : values };
  }
  revalidatePath(`/teach/sessions/${sessionId}`);
  redirect(`/teach/sessions/${sessionId}/register?saved=${row!.register_version}`);
}
