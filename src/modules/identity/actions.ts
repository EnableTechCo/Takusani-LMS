"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasPublicEnvironment } from "@/config/env";
import { fieldErrors, type FormState } from "@/lib/form-state";
import { createAdminClient, createLockoutClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, homePathFor, newAccountSchema, newPasswordSchema, safeNextPath, signInSchema } from "./access";
import { getMyAccess } from "./session";

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

// One message for every sign-in failure, so it never reveals whether an account exists (UX 5.2, P0-01).
const WRONG_DETAILS = "The email or password is not correct.";

/**
 * Password sign-in goes through here so wrong passwords can be counted (S3-06, FR-106, ADR-026): a locked account
 * gets the same answer as a wrong password, without the password being tried. The lock stops new sign-ins only;
 * nothing else reads it, so an existing session and an exam keep working.
 */
export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = signInSchema.safeParse({ email: values.email, password: text(form, "password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (!hasPublicEnvironment()) return { message: "Sign-in is not available on this site yet.", values };

  const lockout = createLockoutClient();
  if (lockout) {
    const { data: locked, error: gateError } = await lockout.rpc("sign_in_gate", { p_email: parsed.data.email });
    if (gateError) console.error(`sign-in gate failed: ${gateError.message}`);
    else if (locked) return { message: WRONG_DETAILS, values };
  }

  const supabase = await createClient();
  const captchaToken = text(form, "cf-turnstile-response") || undefined;
  const { error } = await supabase.auth.signInWithPassword({ ...parsed.data, options: { captchaToken } });
  if (error) {
    // Logged for operators (never shown): wrong details, or a project problem such as the email provider being
    // off, look identical to the person signing in.
    // A deactivated account is banned in Auth: the same answer, and not counted.
    if (error.code === "user_banned") return { message: WRONG_DETAILS, values };
    if (error.code === "invalid_credentials") {
      await lockout?.rpc("record_sign_in_failure", { p_email: parsed.data.email });
    } else {
      console.error(`sign-in refused: ${error.code ?? error.message}`);
    }
    return { message: WRONG_DETAILS, values };
  }
  await lockout?.rpc("record_sign_in_success", { p_email: parsed.data.email });

  // Ask with the client that just signed in: it holds the new session, whereas the session cookie it set is only
  // readable from the next request.
  const { data: accessRows, error: accessError } = await supabase.rpc("my_access");
  if (accessError) throw new Error(`api.my_access failed: ${accessError.message}`);
  const access = accessRows?.[0] ?? null;
  if (access?.status !== "active") {
    await supabase.auth.signOut();
    return { message: WRONG_DETAILS, values };
  }

  redirect(safeNextPath(text(form, "next")) ?? homePathFor(access));
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = emailSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  // The email template links to /auth/confirm?type=recovery. Errors are not shown: the reply is the same whether
  // or not the account exists (G-02).
  const captchaToken = text(form, "cf-turnstile-response") || undefined;
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { captchaToken });
  return { done: true };
}

/** Sets the password after an invitation link or a reset link has signed the person in (/auth/confirm). */
export async function setNewPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password: text(form, "password"), confirm: text(form, "confirm") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return error.code === "same_password"
      ? { errors: { password: "Choose a password you have not used for this account before." } }
      : { message: "Your link has expired. Ask for a new one." };
  }

  redirect(homePathFor(await getMyAccess()));
}

const REFUSALS: Record<string, string> = {
  forbidden: "Only an administrator can create accounts.",
  unauthenticated: "Your session has ended. Sign in again.",
  invalid_role: "Choose a role.",
  invalid_name: "Enter the person's full name.",
  learner_number_taken: "Another account already has this learner number.",
  already_exists: "An account with this email already exists.",
  user_not_found: "The account could not be created. Try again.",
};

/**
 * X-02 New account. The auth user is created and invited with the secret key (the Auth admin API), then the
 * profile and role are created with the administrator's own session, so the database checks the caller and
 * records them as the actor. If that refuses, the auth user is deleted again so nothing is left half made.
 */
export async function createAccount(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    fullName: text(form, "fullName"),
    email: text(form, "email"),
    role: text(form, "role"),
    learnerNumber: text(form, "learnerNumber"),
  };
  const parsed = newAccountSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  // Checked here to avoid creating an auth user at all for a non-administrator; the database checks again.
  const access = await getMyAccess();
  if (!access?.roles.includes("administrator") || access.status !== "active") {
    return { message: REFUSALS.forbidden, values };
  }

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.fullName },
  });
  if (inviteError || !invited.user) {
    const exists = inviteError?.code === "email_exists" || /already been registered/i.test(inviteError?.message ?? "");
    return exists
      ? { errors: { email: REFUSALS.already_exists }, values }
      : { message: "The invitation could not be sent. Try again in a few minutes.", values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_account", {
    p_user_id: invited.user.id,
    p_full_name: parsed.data.fullName,
    p_role: parsed.data.role,
    p_learner_number: parsed.data.learnerNumber,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");

  if (status !== "ok") {
    await admin.auth.admin.deleteUser(invited.user.id);
    const message = REFUSALS[status] ?? "The account could not be created. Try again.";
    return status === "learner_number_taken" ? { errors: { learnerNumber: message }, values } : { message, values };
  }

  redirect(`/admin/accounts?created=${encodeURIComponent(parsed.data.email)}`);
}

/**
 * FR-106: an administrator unlocks an account whose new sign-ins are locked after wrong passwords. The database
 * checks the caller, audits the unlock and tells the person.
 */
export async function unlockAccount(profileId: string, returnTo: "list" | "account" = "list"): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unlock_account", { p_profile_id: profileId });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  revalidatePath("/admin/accounts");
  revalidatePath(`/admin/accounts/${profileId}`);
  redirect(
    returnTo === "account" ? `/admin/accounts/${profileId}?unlock=${status}` : `/admin/accounts?unlock=${status}`,
  );
}
