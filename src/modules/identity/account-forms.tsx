"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { updateAccount } from "./account-actions";

const LABELS = { fullName: "Full name", learnerNumber: "Learner number" };

/** X-03 details (FR-103): the name, and a learner number where there is one. Audited with the previous value. */
export function AccountDetailsForm({
  profileId,
  fullName,
  learnerNumber,
}: {
  profileId: string;
  fullName: string;
  learnerNumber: string | null;
}) {
  const [state, action] = useActionState(updateAccount.bind(null, profileId), {} as FormState);
  const values = state.values ?? {};
  return (
    <form action={action} className="form" noValidate>
      {state.done && state.message ? <Banner compact role="status" title={state.message} tone="positive" /> : null}
      {!state.done && state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LABELS} />
      <TextField
        autoComplete="off"
        defaultValue={values.fullName ?? fullName}
        error={state.errors?.fullName}
        label={LABELS.fullName}
        name="fullName"
      />
      <TextField
        defaultValue={values.learnerNumber ?? learnerNumber ?? ""}
        error={state.errors?.learnerNumber}
        help="Only for learners. It must be unique."
        label={LABELS.learnerNumber}
        name="learnerNumber"
        optional
      />
      <div className="form__actions">
        <SubmitButton pendingLabel="Saving the details">Save details</SubmitButton>
      </div>
    </form>
  );
}
