"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Banner, ErrorSummary, SubmitButton, TextField } from "@/components/forms/form-parts";
import type { FormState } from "@/lib/form-state";
import { createCohort, createProgramme, enrolLearner } from "./actions";

const initial: FormState = {};

const PROGRAMME_LABELS = { code: "Programme code", title: "Title", nqfLevel: "NQF level" };

export function NewProgrammeForm() {
  const [state, action] = useActionState(createProgramme, initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={PROGRAMME_LABELS} />
      <TextField
        defaultValue={state.values?.code}
        error={state.errors?.code}
        help="A short, unique reference, for example CBA-NQF4."
        label={PROGRAMME_LABELS.code}
        name="code"
      />
      <TextField
        defaultValue={state.values?.title}
        error={state.errors?.title}
        label={PROGRAMME_LABELS.title}
        name="title"
      />
      <TextField
        defaultValue={state.values?.nqfLevel}
        error={state.errors?.nqfLevel}
        help="1 to 10."
        label={PROGRAMME_LABELS.nqfLevel}
        name="nqfLevel"
        optional
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Creating programme">Create programme</SubmitButton>
        <Link className="link" href="/coordinate/cohorts">
          Cancel
        </Link>
      </div>
    </form>
  );
}

const COHORT_LABELS = { programmeId: "Programme", name: "Cohort name", startsOn: "Starts", endsOn: "Ends" };

export function NewCohortForm({
  programmes,
  selected,
}: {
  programmes: { id: string; code: string; title: string }[];
  selected?: string;
}) {
  const [state, action] = useActionState(createCohort, initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={COHORT_LABELS} />
      <TextField error={state.errors?.programmeId} label={COHORT_LABELS.programmeId} name="programmeId">
        <span className="select">
          <select
            aria-describedby={state.errors?.programmeId ? "field-programmeId-error" : undefined}
            aria-invalid={state.errors?.programmeId ? true : undefined}
            defaultValue={state.values?.programmeId ?? selected ?? ""}
            id="field-programmeId"
            // A select ignores a changed defaultValue after a form action; re-mount it to keep the choice.
            key={state.values?.programmeId ?? selected ?? ""}
            name="programmeId"
            required
          >
            <option disabled value="">
              Choose a programme
            </option>
            {programmes.map((programme) => (
              <option key={programme.id} value={programme.id}>
                {programme.title} ({programme.code})
              </option>
            ))}
          </select>
        </span>
      </TextField>
      <TextField
        defaultValue={state.values?.name}
        error={state.errors?.name}
        help="How staff and learners will recognise it, for example 2027 Intake A."
        label={COHORT_LABELS.name}
        name="name"
      />
      <div className="grid grid--2">
        <DateField
          defaultValue={state.values?.startsOn}
          error={state.errors?.startsOn}
          label="Starts"
          name="startsOn"
        />
        <DateField defaultValue={state.values?.endsOn} error={state.errors?.endsOn} label="Ends" name="endsOn" />
      </div>
      <p className="text-small text-muted">
        New cohorts are not moderated: each result is released when the assessor finalises it. Choosing moderation
        arrives with cohort setup.
      </p>
      <div className="cluster">
        <SubmitButton pendingLabel="Creating cohort">Create cohort</SubmitButton>
        <Link className="link" href="/coordinate/cohorts">
          Cancel
        </Link>
      </div>
    </form>
  );
}

function DateField({
  name,
  label,
  error,
  defaultValue,
}: {
  name: string;
  label: string;
  error?: string;
  defaultValue?: string;
}) {
  return (
    <TextField error={error} label={label} name={name}>
      <input
        aria-describedby={error ? `field-${name}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className="input"
        defaultValue={defaultValue}
        id={`field-${name}`}
        name={name}
        required
        type="date"
      />
    </TextField>
  );
}

export function EnrolLearnerForm({ cohortId }: { cohortId: string }) {
  const [state, action] = useActionState(enrolLearner.bind(null, cohortId), initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.done && state.message ? <Banner title={state.message} tone="positive" /> : null}
      {!state.done && state.message ? <Banner title={state.message} tone="critical" /> : null}
      <TextField
        autoComplete="off"
        defaultValue={state.done ? "" : state.values?.email}
        error={state.errors?.email}
        help="The learner's account must exist first. Administrators create accounts."
        label="Learner's email address"
        name="email"
        type="email"
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Enrolling">Enrol learner</SubmitButton>
      </div>
    </form>
  );
}
