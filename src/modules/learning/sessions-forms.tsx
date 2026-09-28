"use client";

import { useActionState, useState } from "react";
import { Fieldset, Radio } from "@/components/ui/choice";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { durationText } from "@/modules/notifications/templates";
import { cancelSession, createSession, updateSession } from "./sessions-actions";
import { DURATIONS, isTeamsLink } from "./sessions-rules";

const initial: FormState = {};

const LABELS = {
  cohortId: "Cohort",
  title: "Title",
  startsAt: "Date and start time",
  duration: "How long",
  teamsUrl: "Teams meeting link",
  venue: "Venue",
  reason: "Reason",
};

export interface SessionValues {
  title: string;
  startsAt: string;
  duration: string;
  mode: "online" | "in_person";
  teamsUrl: string;
  venue: string;
}

/**
 * F-06: schedule a session, or change one. The Teams link is checked as it is typed (FR-206), and the form says who
 * will be told (FR-207).
 */
export function SessionForm({
  cohorts,
  session,
  audience,
}: {
  /** For a new session: the cohorts to choose from, each with how many learners it reaches. */
  cohorts?: { id: string; label: string; audience: number }[];
  /** For a change: the session as it is, and its version. */
  session?: { id: string; version: number; values: SessionValues };
  /** For a change: how many learners a change of time or place tells. */
  audience?: number;
}) {
  const action = session ? updateSession.bind(null, session.id, session.version) : createSession;
  const [state, formAction] = useActionState(action, initial);
  const values = { ...(session?.values ?? {}), ...(state.values ?? {}) } as Partial<SessionValues> & {
    cohortId?: string;
  };
  const [mode, setMode] = useState<"online" | "in_person">(values.mode ?? "online");
  const [cohortId, setCohortId] = useState(values.cohortId ?? "");
  const [link, setLink] = useState(values.teamsUrl ?? "");
  const linkProblem = mode === "online" && link.trim() !== "" && !isTeamsLink(link);
  const told = session ? audience : cohorts?.find((cohort) => cohort.id === cohortId)?.audience;

  return (
    <form action={formAction} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LABELS} />
      {cohorts ? (
        <div
          onChange={(event) => {
            if (event.target instanceof HTMLSelectElement) setCohortId(event.target.value);
          }}
        >
          <SelectField
            defaultValue={values.cohortId}
            error={state.errors?.cohortId}
            label={LABELS.cohortId}
            name="cohortId"
            options={cohorts.map((cohort) => ({ value: cohort.id, label: cohort.label }))}
            placeholder="Choose a cohort"
          />
        </div>
      ) : null}
      <TextField defaultValue={values.title} error={state.errors?.title} label={LABELS.title} name="title" />
      <TextField
        defaultValue={values.startsAt}
        error={state.errors?.startsAt}
        help="South African time."
        label={LABELS.startsAt}
        name="startsAt"
        type="datetime-local"
      />
      <SelectField
        defaultValue={values.duration ?? "120"}
        error={state.errors?.duration}
        label={LABELS.duration}
        name="duration"
        options={DURATIONS.map((minutes) => ({ value: String(minutes), label: durationText(minutes) }))}
      />
      <Fieldset legend="Where">
        <div onChange={(event) => setMode((event.target as HTMLInputElement).value as "online" | "in_person")}>
          <Radio defaultChecked={mode === "online"} label="Online, in Microsoft Teams" name="mode" value="online" />
          <Radio defaultChecked={mode === "in_person"} label="In person" name="mode" value="in_person" />
        </div>
      </Fieldset>
      {mode === "online" ? (
        <div onChange={(event) => setLink((event.target as HTMLInputElement).value)}>
          <TextField
            defaultValue={values.teamsUrl}
            error={
              state.errors?.teamsUrl ??
              (linkProblem
                ? "This is not a Teams meeting link. Copy it from the meeting in Teams: it starts with https://teams.microsoft.com/l/meetup-join/."
                : undefined)
            }
            help="In Teams, open the meeting and choose Copy link. Learners can join from 10 minutes before it starts."
            label={LABELS.teamsUrl}
            name="teamsUrl"
            type="url"
          />
        </div>
      ) : (
        <TextField defaultValue={values.venue} error={state.errors?.venue} label={LABELS.venue} name="venue" />
      )}
      {told !== undefined ? (
        <p className="text-small text-muted">
          {session
            ? `A change of time, length or place tells the ${told === 1 ? "1 learner" : `${told} learners`} in the cohort. A new title alone does not.`
            : `${told === 1 ? "1 learner" : `${told} learners`} in this cohort will be told in the LMS.`}
        </p>
      ) : null}
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">{session ? "Save changes" : "Schedule session"}</SubmitButton>
      </div>
    </form>
  );
}

/** Cancelling says why; the learners are told the reason, and the session stays on their calendar, marked. */
export function CancelSessionForm({ sessionId }: { sessionId: string }) {
  const [state, action] = useActionState(cancelSession.bind(null, sessionId), initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <TextareaField
        error={state.errors?.reason}
        help="The learners see this with the cancellation."
        label={LABELS.reason}
        name="reason"
        rows={2}
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Cancelling">Cancel this session</SubmitButton>
      </div>
    </form>
  );
}
