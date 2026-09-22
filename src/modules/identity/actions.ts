"use server";

import { redirect } from "next/navigation";
import { hasPublicEnvironment } from "@/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  emailSchema,
  fieldErrors,
  newAccountSchema,
  newPasswordSchema,
  safeNextPath,
  signInSchema,
  toNavigationSubject,
} from "./access";
import { landingPathFor } from "./navigation";
import { getMyAccess } from "./session";

export interface FormState {
  /** One message for the whole form, shown in an error summary or banner. */
  message?: string;
  errors?: Record<string, string>;
  /** Values to put back in the fields after a refusal (never passwords). */
  values?: Record<string, string>;
  done?: boolean;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

// One message for every sign-in failure, so it never reveals whether an account exists (UX 5.2, P0-01).
const WRONG_DETAILS = "The email or password is not correct.";

export async function signIn(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = signInSchema.safeParse({ email: values.email, password: text(form, "password") });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };
  if (!hasPublicEnvironment()) return { message: "Sign-in is not available on this site yet.", values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    // Logged for operators (never shown): wrong details, or a project problem such as the email provider being
    // off, look identical to the person signing in.
    if (error.code !== "invalid_credentials") console.error(`sign-in refused: ${error.code ?? error.message}`);
    return { message: WRONG_DETAILS, values };
  }

  // Ask with the client that just signed in: it holds the new session, whereas the session cookie it set is only
  // readable from the next request.
  const { data: accessRows, error: accessError } = await supabase.rpc("my_access");
  if (accessError) throw new Error(`api.my_access failed: ${accessError.message}`);
  const access = accessRows?.[0] ?? null;
  if (access?.status !== "active") {
    await supabase.auth.signOut();
    return { message: WRONG_DETAILS, values };
  }

  redirect(safeNextPath(text(form, "next")) ?? landingPathFor(toNavigationSubject(access)));
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const values = { email: text(form, "email") };
  const parsed = emailSchema.safeParse(values);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  // The email template links to /auth/confirm?type=recovery. Errors are not shown: the reply is the same whether
  // or not the account exists (G-02).
  await supabase.auth.resetPasswordForEmail(parsed.data.email);
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

  const access = await getMyAccess();
  redirect(landingPathFor(toNavigationSubject(access)));
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
