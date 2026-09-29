"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui/button-class";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { actOnQuery, logQuery, routeQuery } from "./query-actions";
import { QUERY_SOURCE_LABELS } from "./query-rules";

const initial: FormState = {};

const LOG_LABELS = {
  programmeId: "Programme",
  cohortId: "Cohort",
  sourceType: "Who it is from",
  sourceName: "Their name or organisation",
  contact: "How to reply",
  subject: "Subject",
  details: "What they asked",
  dueOn: "Reply by",
};

/** C-10 log a query: who raised it, about which programme (and cohort), what they asked, and by when. */
export function LogQueryForm({
  programmes,
  cohorts,
}: {
  programmes: { id: string; title: string }[];
  cohorts: { id: string; label: string }[];
}) {
  const [state, action] = useActionState(logQuery, initial);
  const values = state.values ?? {};
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LOG_LABELS} />
      <SelectField
        defaultValue={values.programmeId}
        error={state.errors?.programmeId}
        label={LOG_LABELS.programmeId}
        name="programmeId"
        options={programmes.map((programme) => ({ value: programme.id, label: programme.title }))}
        placeholder="Choose a programme"
      />
      <SelectField
        defaultValue={values.cohortId}
        error={state.errors?.cohortId}
        help="When it is about one cohort."
        label={LOG_LABELS.cohortId}
        name="cohortId"
        optional
        options={[
          { value: "", label: "The whole programme" },
          ...cohorts.map((c) => ({ value: c.id, label: c.label })),
        ]}
      />
      <SelectField
        defaultValue={values.sourceType}
        error={state.errors?.sourceType}
        label={LOG_LABELS.sourceType}
        name="sourceType"
        options={Object.entries(QUERY_SOURCE_LABELS).map(([value, label]) => ({ value, label }))}
        placeholder="Choose one"
      />
      <TextField
        defaultValue={values.sourceName}
        error={state.errors?.sourceName}
        label={LOG_LABELS.sourceName}
        name="sourceName"
      />
      <TextField
        defaultValue={values.contact}
        error={state.errors?.contact}
        help="An email address or phone number, only if you will reply to them."
        label={LOG_LABELS.contact}
        name="contact"
        optional
      />
      <TextField
        defaultValue={values.subject}
        error={state.errors?.subject}
        label={LOG_LABELS.subject}
        name="subject"
      />
      <TextareaField
        defaultValue={values.details}
        error={state.errors?.details}
        label={LOG_LABELS.details}
        name="details"
        rows={4}
      />
      <TextField
        defaultValue={values.dueOn}
        error={state.errors?.dueOn}
        label={LOG_LABELS.dueOn}
        name="dueOn"
        optional
        type="date"
      />
      <div className="form__actions">
        <SubmitButton pendingLabel="Logging the query">Log query</SubmitButton>
      </div>
    </form>
  );
}

/** Routing to a coordinator who covers the query. The note goes to them with the notification. */
export function RouteQueryForm({
  queryId,
  ownerId,
  owners,
}: {
  queryId: string;
  ownerId: string | null;
  owners: { profile_id: string; full_name: string }[];
}) {
  const [state, action] = useActionState(routeQuery.bind(null, queryId), initial);
  const values = state.done ? {} : (state.values ?? {});
  return (
    <form action={action} className="stack" key={state.done ? `routed-${ownerId}` : "routing"} noValidate>
      {state.done ? <Banner compact role="status" title="Routed. They have been told." tone="positive" /> : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ ownerId: "Route to", routeNote: "Note for them" }} />
      <SelectField
        defaultValue={values.ownerId ?? ownerId ?? undefined}
        error={state.errors?.ownerId}
        label="Route to"
        name="ownerId"
        options={owners.map((owner) => ({ value: owner.profile_id, label: owner.full_name }))}
        placeholder="Choose a coordinator"
      />
      <TextareaField
        defaultValue={values.routeNote}
        error={state.errors?.routeNote}
        label="Note for them"
        name="routeNote"
        optional
        rows={2}
      />
      <div className="form__actions">
        <SubmitButton pendingLabel="Routing">{ownerId ? "Route to someone else" : "Route query"}</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Working the query. One note box and the steps open to it now: start it, add the note, close it with the note as the
 * resolution, or reopen it with the note as the reason.
 */
export function QueryActionsForm({
  queryId,
  state: queryState,
  steps,
}: {
  queryId: string;
  state: string;
  steps: number;
}) {
  const [state, action] = useActionState(actOnQuery.bind(null, queryId), initial);
  const values = state.done ? {} : (state.values ?? {});
  const closed = queryState === "closed";
  return (
    <form action={action} className="stack" key={steps} noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ note: closed ? "Why it is being reopened" : "Note" }} />
      <TextareaField
        defaultValue={values.note}
        error={state.errors?.note}
        help={
          closed
            ? "Say why it is being reopened. It stays in the history."
            : "A note stays in the history. To close the query, write how it was resolved here."
        }
        label={closed ? "Why it is being reopened" : "Note"}
        name="note"
        optional={!closed}
        rows={3}
      />
      <div className="cluster">
        {closed ? (
          <button className={buttonClass({ variant: "primary" })} name="action" type="submit" value="reopen">
            Reopen query
          </button>
        ) : (
          <>
            {queryState === "open" ? (
              <button className={buttonClass({ variant: "secondary" })} name="action" type="submit" value="start">
                Start on it
              </button>
            ) : null}
            <button className={buttonClass({ variant: "secondary" })} name="action" type="submit" value="note">
              Add note
            </button>
            <button className={buttonClass({ variant: "primary" })} name="action" type="submit" value="close">
              Close with this resolution
            </button>
          </>
        )}
      </div>
    </form>
  );
}
