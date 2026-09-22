"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Banner, ErrorSummary, SubmitButton, TextField } from "@/components/forms/form-parts";
import { createAccount, requestPasswordReset, setNewPassword, signIn, type FormState } from "./actions";
import { PASSWORD_MIN, ROLE_LABELS } from "./access";
import { ROLES } from "./navigation";

const initial: FormState = {};

export function SignInForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(signIn, initial);
  const [showPassword, setShowPassword] = useState(false);
  return (
    <form action={action} className="stack" noValidate>
      {notice && !state.message ? <Banner title={notice} tone="info" /> : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ email: "Email address", password: "Password" }} />
      <input name="next" type="hidden" value={next ?? ""} />
      <TextField
        autoComplete="username"
        defaultValue={state.values?.email}
        error={state.errors?.email}
        label="Email address"
        name="email"
        type="email"
      />
      <TextField
        autoComplete="current-password"
        error={state.errors?.password}
        label="Password"
        name="password"
        type={showPassword ? "text" : "password"}
      />
      <label className="check">
        <input
          checked={showPassword}
          className="check__input"
          onChange={(event) => setShowPassword(event.target.checked)}
          type="checkbox"
        />
        <span className="check__label">Show password</span>
      </label>
      <div className="cluster">
        <SubmitButton pendingLabel="Signing in">Sign in</SubmitButton>
        <Link className="link" href="/forgot-password">
          Forgot your password?
        </Link>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  if (state.done) {
    return (
      <div className="stack">
        <Banner title="Check your email" tone="positive">
          <p>
            If an account uses that email address, we have sent it a link to choose a new password. The link expires in
            one hour.
          </p>
        </Banner>
        <Link className="link" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <form action={action} className="stack" noValidate>
      <ErrorSummary errors={state.errors} labels={{ email: "Email address" }} />
      <TextField
        autoComplete="email"
        defaultValue={state.values?.email}
        error={state.errors?.email}
        help="We will email you a link to choose a new password."
        label="Email address"
        name="email"
        type="email"
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Sending">Send reset link</SubmitButton>
        <Link className="link" href="/sign-in">
          Back to sign in
        </Link>
      </div>
    </form>
  );
}

export function NewPasswordForm({ submitLabel }: { submitLabel: string }) {
  const [state, action] = useActionState(setNewPassword, initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? (
        <Banner title={state.message} tone="critical">
          <Link className="link" href="/forgot-password">
            Send a new link
          </Link>
        </Banner>
      ) : null}
      <ErrorSummary errors={state.errors} labels={{ password: "New password", confirm: "Confirm new password" }} />
      <TextField
        autoComplete="new-password"
        error={state.errors?.password}
        help={`At least ${PASSWORD_MIN} characters. A short sentence is easy to remember and hard to guess.`}
        label="New password"
        name="password"
        type="password"
      />
      <TextField
        autoComplete="new-password"
        error={state.errors?.confirm}
        label="Confirm new password"
        name="confirm"
        type="password"
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

const ACCOUNT_LABELS = { fullName: "Full name", email: "Email address", role: "Role", learnerNumber: "Learner number" };

export function NewAccountForm() {
  const [state, action] = useActionState(createAccount, initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={ACCOUNT_LABELS} />
      <TextField
        autoComplete="off"
        defaultValue={state.values?.fullName}
        error={state.errors?.fullName}
        label={ACCOUNT_LABELS.fullName}
        name="fullName"
      />
      <TextField
        autoComplete="off"
        defaultValue={state.values?.email}
        error={state.errors?.email}
        help="The invitation is sent here. The person chooses their own password."
        label={ACCOUNT_LABELS.email}
        name="email"
        type="email"
      />
      <TextField error={state.errors?.role} label={ACCOUNT_LABELS.role} name="role">
        <span className="select">
          <select
            aria-describedby={state.errors?.role ? "field-role-error" : undefined}
            aria-invalid={state.errors?.role ? true : undefined}
            defaultValue={state.values?.role ?? ""}
            id="field-role"
            name="role"
            required
          >
            <option disabled value="">
              Choose a role
            </option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </span>
      </TextField>
      <TextField
        autoComplete="off"
        defaultValue={state.values?.learnerNumber}
        error={state.errors?.learnerNumber}
        help="For learners, as it appears on their enrolment."
        label={ACCOUNT_LABELS.learnerNumber}
        name="learnerNumber"
        optional
      />
      <p className="text-small text-muted">
        The role applies across the whole institution for now. Roles for one programme or cohort arrive with cohort
        setup.
      </p>
      <div className="cluster">
        <SubmitButton pendingLabel="Creating account">Create and invite</SubmitButton>
        <Link className="link" href="/admin/accounts">
          Cancel
        </Link>
      </div>
    </form>
  );
}
