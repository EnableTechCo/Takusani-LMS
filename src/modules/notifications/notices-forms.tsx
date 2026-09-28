"use client";

import { useActionState, useState } from "react";
import { Fieldset, Radio } from "@/components/ui/choice";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { ROLE_LABELS } from "@/modules/identity/access";
import { ROLES } from "@/modules/identity/navigation";
import { createNotice } from "./notices-actions";

const initial: FormState = {};

const LABELS = {
  title: "Title",
  body: "Message",
  cohortId: "Cohort",
  role: "Role group",
  sendAt: "Send at",
};

/**
 * C-09 new notice (FR-703): the message, who it is for, and when. Role groups and everyone are offered only to
 * someone who may use them; the database checks again.
 */
export function NoticeForm({
  cohorts,
  canSendWide,
}: {
  cohorts: { id: string; name: string; programme: string; learners: number }[];
  canSendWide: boolean;
}) {
  const [state, action] = useActionState(createNotice, initial);
  const values = state.values ?? {};
  const [audience, setAudience] = useState(values.audience ?? (cohorts.length > 0 ? "cohort" : "everyone"));
  const [when, setWhen] = useState(values.when ?? "now");

  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LABELS} />
      <TextField defaultValue={values.title} error={state.errors?.title} label={LABELS.title} name="title" />
      <TextareaField
        defaultValue={values.body}
        error={state.errors?.body}
        help="Plain words. A blank line starts a new paragraph."
        label={LABELS.body}
        name="body"
        rows={6}
      />

      <Fieldset legend="Who is it for?">
        <div onChange={(event) => setAudience((event.target as HTMLInputElement).value)}>
          {cohorts.length > 0 ? (
            <Radio
              defaultChecked={audience === "cohort"}
              label="The learners in a cohort"
              name="audience"
              value="cohort"
            />
          ) : null}
          {canSendWide ? (
            <>
              <Radio
                defaultChecked={audience === "role"}
                label="Everyone in a role group"
                name="audience"
                value="role"
              />
              <Radio defaultChecked={audience === "everyone"} label="Everyone" name="audience" value="everyone" />
            </>
          ) : null}
        </div>
      </Fieldset>
      {audience === "cohort" ? (
        <SelectField
          defaultValue={values.cohortId}
          error={state.errors?.cohortId}
          label={LABELS.cohortId}
          name="cohortId"
          options={cohorts.map((cohort) => ({
            value: cohort.id,
            label: `${cohort.name}, ${cohort.programme} (${cohort.learners} ${cohort.learners === 1 ? "learner" : "learners"})`,
          }))}
          placeholder="Choose a cohort"
        />
      ) : null}
      {audience === "role" ? (
        <SelectField
          defaultValue={values.role}
          error={state.errors?.role}
          label={LABELS.role}
          name="role"
          options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
          placeholder="Choose a role"
        />
      ) : null}

      <Fieldset legend="When?">
        <div onChange={(event) => setWhen((event.target as HTMLInputElement).value)}>
          <Radio defaultChecked={when === "now"} label="Send now" name="when" value="now" />
          <Radio defaultChecked={when === "later"} label="At a later time" name="when" value="later" />
        </div>
      </Fieldset>
      {when === "later" ? (
        <TextField
          defaultValue={values.sendAt}
          error={state.errors?.sendAt}
          help="South African time. It goes out within a minute of this time."
          label={LABELS.sendAt}
          name="sendAt"
          type="datetime-local"
        />
      ) : null}

      <p className="text-small text-muted">
        Each person is told in the LMS (and by email once email is switched on). You see who was told and who has read
        it.
      </p>
      <div className="cluster">
        <SubmitButton pendingLabel="Sending">{when === "later" ? "Schedule notice" : "Send notice"}</SubmitButton>
      </div>
    </form>
  );
}
