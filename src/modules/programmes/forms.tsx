"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SelectField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
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
      <SelectField
        defaultValue={state.values?.programmeId ?? selected}
        error={state.errors?.programmeId}
        label={COHORT_LABELS.programmeId}
        name="programmeId"
        options={programmes.map((programme) => ({
          value: programme.id,
          label: `${programme.title} (${programme.code})`,
        }))}
        placeholder="Choose a programme"
      />
      <TextField
        defaultValue={state.values?.name}
        error={state.errors?.name}
        help="How staff and learners will recognise it, for example 2027 Intake A."
        label={COHORT_LABELS.name}
        name="name"
      />
      <div className="grid grid--2">
        <TextField
          defaultValue={state.values?.startsOn}
          error={state.errors?.startsOn}
          label={COHORT_LABELS.startsOn}
          name="startsOn"
          type="date"
        />
        <TextField
          defaultValue={state.values?.endsOn}
          error={state.errors?.endsOn}
          label={COHORT_LABELS.endsOn}
          name="endsOn"
          type="date"
        />
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
