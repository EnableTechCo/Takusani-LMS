"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasServerEnvironment } from "@/config/env";
import { fieldErrors, type FormState } from "@/lib/form-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { accountDetailsSchema } from "./access";

// X-03 account administration (S3-08; FR-103, FR-105, FR-106). The database checks that the caller is an
// administrator, refuses deactivation while open work depends on the person, and audits each change. The Auth side
// (a ban on a deactivated account, the reset email) uses the secret key, only after the database has agreed.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const page = (profileId: string) => `/admin/accounts/${profileId}`;

const DETAIL_REFUSALS: Record<string, string> = {
  forbidden: "Only an administrator can change an account.",
  not_found: "This account no longer exists.",
  invalid_name: "Enter the person's full name.",
  learner_number_taken: "Another account already has this learner number.",
  unauthenticated: "Your session has ended. Sign in again.",
};

export async function updateAccount(profileId: string, _: FormState, form: FormData): Promise<FormState> {
  const values = { fullName: text(form, "fullName"), learnerNumber: text(form, "learnerNumber") };
  const parsed = accountDetailsSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_account", {
    p_profile_id: profileId,
    p_full_name: parsed.data.fullName,
    p_learner_number: parsed.data.learnerNumber || undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    const message = DETAIL_REFUSALS[status] ?? "The details could not be saved. Try again.";
    if (status === "learner_number_taken") return { errors: { learnerNumber: message }, values };
    if (status === "invalid_name") return { errors: { fullName: message }, values };
    return { message, values };
  }
  revalidatePath(page(profileId));
  revalidatePath("/admin/accounts");
  return { done: true, message: "Details saved.", values };
}

/**
 * Supabase Auth's side of deactivation: a ban stops new sign-ins and session refreshes; the database already refuses
 * every request. Skipped, and logged, when the secret key is not set.
 */
async function setAuthBan(profileId: string, banned: boolean) {
  if (!hasServerEnvironment()) {
    console.error("account ban not applied in Supabase Auth: SUPABASE_SECRET_KEY is not set");
    return;
  }
  const { error } = await createAdminClient().auth.admin.updateUserById(profileId, {
    ban_duration: banned ? "876000h" : "none",
  });
  if (error) console.error(`account ban not applied in Supabase Auth: ${error.message}`);
}

export async function deactivateAccount(profileId: string, form: FormData): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("deactivate_account", {
    p_profile_id: profileId,
    p_reason: text(form, "reason") || undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status === "ok") await setAuthBan(profileId, true);
  revalidatePath(page(profileId));
  revalidatePath("/admin/accounts");
  redirect(`${page(profileId)}?status=${status}`);
}

export async function reactivateAccount(profileId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reactivate_account", { p_profile_id: profileId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status === "ok") await setAuthBan(profileId, false);
  revalidatePath(page(profileId));
  revalidatePath("/admin/accounts");
  redirect(`${page(profileId)}?status=${status === "ok" ? "reactivated" : status}`);
}

/**
 * FR-106: the database checks the administrator, records the reset and tells the person; then Supabase Auth emails
 * the link (the recovery template, which lands on /auth/confirm). Sent with the secret key, so a CAPTCHA on the public
 * reset form does not apply to an administrator's request.
 */
export async function sendPasswordReset(profileId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_password_reset", { p_profile_id: profileId });
  const row = data?.[0];
  let status = error ? "error" : (row?.status ?? "error");
  if (status === "ok" && row?.email) {
    const sender = hasServerEnvironment() ? createAdminClient() : supabase;
    const { error: sendError } = await sender.auth.resetPasswordForEmail(row.email);
    if (sendError) {
      console.error(`password reset email not sent: ${sendError.message}`);
      status = "not_sent";
    }
  }
  redirect(`${page(profileId)}?reset=${status}`);
}
