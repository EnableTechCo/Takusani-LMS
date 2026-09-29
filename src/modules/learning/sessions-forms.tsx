"use client";

import { useActionState, useState } from "react";
import { Checkbox, Fieldset, Radio } from "@/components/ui/choice";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { durationText } from "@/modules/notifications/templates";
import { cancelSession, createSession, updateSession } from "./sessions-actions";
import { parseSeriesCount, REPEATS, seriesSentence, SERIES_COUNT, type Repeat } from "./series-rules";
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
  repeat: "Repeats",
  count: "Number of sessions",
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
    repeat?: Repeat;
    count?: string;
  };
  const [mode, setMode] = useState<"online" | "in_person">(values.mode ?? "online");
  const [cohortId, setCohortId] = useState(values.cohortId ?? "");
  const [link, setLink] = useState(values.teamsUrl ?? "");
  const [startsAt, setStartsAt] = useState(values.startsAt ?? "");
  const [repeat, setRepeat] = useState<Repeat>(values.repeat ?? "none");
  const [count, setCount] = useState(values.count ?? "6");
  const seriesCount = parseSeriesCount(count);
  const preview =
    repeat !== "none" && seriesCount !== null && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startsAt)
      ? seriesSentence(`${startsAt}:00+02:00`, repeat, seriesCount)
      : null;
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
      <div onChange={(event) => setStartsAt((event.target as HTMLInputElement).value)}>
        <TextField
          defaultValue={values.startsAt}
          error={state.errors?.startsAt}
          help="South African time."
          label={LABELS.startsAt}
          name="startsAt"
          type="datetime-local"
        />
      </div>
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
      {session ? null : (
        <Fieldset legend={LABELS.repeat}>
          <div onChange={(event) => setRepeat((event.target as HTMLInputElement).value as Repeat)}>
            {REPEATS.map((option) => (
              <Radio
                defaultChecked={repeat === option.value}
                key={option.value}
                label={option.label}
                name="repeat"
                value={option.value}
              />
            ))}
          </div>
          {repeat !== "none" ? (
            <>
              <div onChange={(event) => setCount((event.target as HTMLInputElement).value)}>
                <TextField
                  defaultValue={count}
                  error={state.errors?.count}
                  help={`From ${SERIES_COUNT.min} to ${SERIES_COUNT.max}. Each session is scheduled on its own, so any one can be changed or cancelled later.`}
                  inputMode="numeric"
                  label={LABELS.count}
                  name="count"
                  type="number"
                />
              </div>
              {preview ? <p className="text-small text-muted">{preview}</p> : null}
            </>
          ) : null}
        </Fieldset>
      )}
      {told !== undefined ? (
        <p className="text-small text-muted">
          {session
            ? `A change of time, length or place tells the ${told === 1 ? "1 learner" : `${told} learners`} in the cohort. A new title alone does not.`
            : repeat !== "none"
              ? `${told === 1 ? "1 learner" : `${told} learners`} in this cohort will be told once, about the whole series.`
              : `${told === 1 ? "1 learner" : `${told} learners`} in this cohort will be told in the LMS.`}
        </p>
      ) : null}
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">
          {session ? "Save changes" : repeat !== "none" ? "Schedule the series" : "Schedule session"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Cancelling says why; the learners are told the reason, and the session stays on their calendar, marked. */
export function CancelSessionForm({
  sessionId,
  laterInSeries = 0,
}: {
  sessionId: string;
  /** How many later sessions of the same series are still scheduled; they can be cancelled with this one. */
  laterInSeries?: number;
}) {
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
      {laterInSeries > 0 ? (
        <Checkbox
          help="With the same reason. The learners are told once, about all of them."
          label={
            laterInSeries === 1
              ? "Also cancel the later session in this series"
              : `Also cancel the ${laterInSeries} later sessions in this series`
          }
          name="restOfSeries"
        />
      ) : null}
      <div className="cluster">
        <SubmitButton pendingLabel="Cancelling">Cancel this session</SubmitButton>
      </div>
    </form>
  );
}
