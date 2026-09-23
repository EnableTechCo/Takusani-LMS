"use client";

import { useActionState, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Radio } from "@/components/ui/choice";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { Field, SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { TextLink } from "@/components/ui/link";
import { Banner } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { createTask, publishTask, setTaskAudience, setTaskCriteria, setTaskRequirements, updateTask } from "./actions";
import { LATE_POLICY_LABELS, SUBMISSION_TYPE_LABELS } from "./rules";

const initial: FormState = {};

const TASK_LABELS = {
  cohortId: "Cohort",
  title: "Title",
  brief: "Brief",
  submissionType: "How the work is handed in",
  dueAt: "Due",
  latePolicy: "Late work",
};

const options = (labels: Record<string, string>) => Object.entries(labels).map(([value, label]) => ({ value, label }));

/** The task's own details. The same fields create a draft and edit it. */
function TaskFields({ state, task }: { state: FormState; task?: TaskDetails }) {
  return (
    <>
      <TextField
        defaultValue={state.values?.title ?? task?.title}
        error={state.errors?.title}
        label={TASK_LABELS.title}
        name="title"
      />
      <TextareaField
        defaultValue={state.values?.brief ?? task?.brief}
        error={state.errors?.brief}
        help="What the learner must do, and what to hand in. Learners read this as it is written."
        label={TASK_LABELS.brief}
        name="brief"
        rows={8}
      />
      <SelectField
        defaultValue={state.values?.submissionType ?? task?.submissionType ?? "file_upload"}
        error={state.errors?.submissionType}
        label={TASK_LABELS.submissionType}
        name="submissionType"
        options={options(SUBMISSION_TYPE_LABELS)}
      />
      <TextField
        defaultValue={state.values?.dueAt ?? task?.dueAt ?? ""}
        error={state.errors?.dueAt}
        help="South African time. A draft can wait, but a task cannot be published without a due date."
        label={TASK_LABELS.dueAt}
        name="dueAt"
        optional
        type="datetime-local"
      />
      <SelectField
        defaultValue={state.values?.latePolicy ?? task?.latePolicy ?? "accept_and_flag"}
        error={state.errors?.latePolicy}
        label={TASK_LABELS.latePolicy}
        name="latePolicy"
        options={options(LATE_POLICY_LABELS)}
      />
    </>
  );
}

export interface TaskDetails {
  id: string;
  title: string;
  brief: string;
  submissionType: string;
  /** As a `datetime-local` value in South African time. */
  dueAt: string;
  latePolicy: string;
}

export function NewTaskForm({
  cohorts,
  selected,
}: {
  cohorts: { id: string; name: string; programmeTitle: string }[];
  selected?: string;
}) {
  const [state, action] = useActionState(createTask, initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={TASK_LABELS} />
      <SelectField
        defaultValue={state.values?.cohortId ?? selected}
        error={state.errors?.cohortId}
        label={TASK_LABELS.cohortId}
        name="cohortId"
        options={cohorts.map((cohort) => ({ value: cohort.id, label: `${cohort.name} (${cohort.programmeTitle})` }))}
        placeholder="Choose a cohort"
      />
      <TaskFields state={state} />
      <p className="text-small text-muted">
        The task is created as a draft. Learners see nothing until you publish it, so you can set the rubric and the
        audience first.
      </p>
      <div className="cluster">
        <SubmitButton pendingLabel="Creating the draft">Create draft</SubmitButton>
        <TextLink href="/teach/tasks">Cancel</TextLink>
      </div>
    </form>
  );
}

export function EditTaskForm({ task }: { task: TaskDetails }) {
  const [state, action] = useActionState(updateTask.bind(null, task.id), initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.done && state.message ? <Banner title={state.message} tone="positive" /> : null}
      {!state.done && state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={TASK_LABELS} />
      <TaskFields state={state} task={task} />
      <div className="cluster">
        <SubmitButton pendingLabel="Saving the draft">Save draft</SubmitButton>
      </div>
    </form>
  );
}

export interface Criterion {
  title: string;
  descriptor?: string | null;
  points?: number | null;
}

/**
 * The rubric the marker will work through (FR-201). Rows are edited here and posted as JSON, so their order is the
 * order marking shows them in.
 */
export function CriteriaForm({ taskId, criteria }: { taskId: string; criteria: Criterion[] }) {
  const [state, action] = useActionState(setTaskCriteria.bind(null, taskId), initial);
  const [rows, setRows] = useState<Criterion[]>(criteria.length ? criteria : [{ title: "" }]);

  const update = (index: number, change: Partial<Criterion>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...change } : row)));

  return (
    <form action={action} className="stack" noValidate>
      {state.done && state.message ? <Banner title={state.message} tone="positive" /> : null}
      {!state.done && state.message ? <Banner title={state.message} tone="critical" /> : null}
      {state.errors?.criteria ? <Banner title={state.errors.criteria} tone="critical" /> : null}
      <input name="criteria" type="hidden" value={JSON.stringify(rows)} />
      <ol className="stack">
        {rows.map((row, index) => (
          <li className="card" key={index}>
            <div className="card__body stack stack--sm">
              <div className="cluster cluster--between">
                <p className="text-subheading">Criterion {index + 1}</p>
                <IconButton
                  disabled={rows.length === 1}
                  icon="trash"
                  label={`Remove criterion ${index + 1}`}
                  onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                />
              </div>
              <Field label="What is being judged" name={`criterion-${index}-title`}>
                {(control) => (
                  <input
                    {...control}
                    className="input"
                    name={undefined}
                    onChange={(event) => update(index, { title: event.target.value })}
                    value={row.title}
                  />
                )}
              </Field>
              <Field label="What meets it" name={`criterion-${index}-descriptor`} optional>
                {(control) => (
                  <textarea
                    {...control}
                    className="textarea"
                    name={undefined}
                    onChange={(event) => update(index, { descriptor: event.target.value })}
                    rows={2}
                    value={row.descriptor ?? ""}
                  />
                )}
              </Field>
              <Field label="Points" name={`criterion-${index}-points`} optional>
                {(control) => (
                  <input
                    {...control}
                    className="input"
                    inputMode="numeric"
                    name={undefined}
                    onChange={(event) =>
                      update(index, { points: event.target.value === "" ? null : Number(event.target.value) })
                    }
                    type="number"
                    value={row.points ?? ""}
                  />
                )}
              </Field>
            </div>
          </li>
        ))}
      </ol>
      <div className="cluster">
        <Button icon="plus" onClick={() => setRows((current) => [...current, { title: "" }])}>
          Add criterion
        </Button>
        <SubmitButton pendingLabel="Saving the rubric">Save rubric</SubmitButton>
      </div>
    </form>
  );
}

export interface Requirement {
  id?: string;
  title: string;
  guidance?: string | null;
  mandatory?: boolean | null;
}

/**
 * What the learner must hand in (FR-311). A requirement marked mandatory blocks the submission until it has a
 * file, so the learner is told which one is missing rather than finding a disabled button.
 */
export function RequirementsForm({ taskId, requirements }: { taskId: string; requirements: Requirement[] }) {
  const [state, action] = useActionState(setTaskRequirements.bind(null, taskId), initial);
  const [rows, setRows] = useState<Requirement[]>(requirements);

  const update = (index: number, change: Partial<Requirement>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...change } : row)));

  return (
    <form action={action} className="stack" noValidate>
      {state.done && state.message ? <Banner title={state.message} tone="positive" /> : null}
      {!state.done && state.message ? <Banner title={state.message} tone="critical" /> : null}
      {state.errors?.requirements ? <Banner title={state.errors.requirements} tone="critical" /> : null}
      <input
        name="requirements"
        type="hidden"
        value={JSON.stringify(rows.map((row) => ({ ...row, mandatory: row.mandatory ?? true })))}
      />
      {rows.length === 0 ? (
        <p className="text-muted">
          This task asks for no files. Add a requirement for each thing the learner must hand in.
        </p>
      ) : (
        <ol className="stack">
          {rows.map((row, index) => (
            <li className="card" key={index}>
              <div className="card__body stack stack--sm">
                <div className="cluster cluster--between">
                  <p className="text-subheading">Evidence {index + 1}</p>
                  <IconButton
                    icon="trash"
                    label={`Remove evidence ${index + 1}`}
                    onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                  />
                </div>
                <Field label="What the learner hands in" name={`requirement-${index}-title`}>
                  {(control) => (
                    <input
                      {...control}
                      className="input"
                      name={undefined}
                      onChange={(event) => update(index, { title: event.target.value })}
                      value={row.title}
                    />
                  )}
                </Field>
                <Field
                  help="Shown beside the file chooser, for example the period it must cover."
                  label="Guidance"
                  name={`requirement-${index}-guidance`}
                  optional
                >
                  {(control) => (
                    <textarea
                      {...control}
                      className="textarea"
                      name={undefined}
                      onChange={(event) => update(index, { guidance: event.target.value })}
                      rows={2}
                      value={row.guidance ?? ""}
                    />
                  )}
                </Field>
                <label className="check">
                  <input
                    checked={row.mandatory ?? true}
                    className="check__input"
                    onChange={(event) => update(index, { mandatory: event.target.checked })}
                    type="checkbox"
                  />
                  <span className="check__label">The learner cannot submit without this</span>
                </label>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="cluster">
        <Button icon="plus" onClick={() => setRows((current) => [...current, { title: "", mandatory: true }])}>
          Add evidence
        </Button>
        <SubmitButton pendingLabel="Saving">Save evidence list</SubmitButton>
      </div>
    </form>
  );
}

/** Who the task is for (FR-201): the whole cohort, or named learners who are enrolled in it. */
export function AudienceForm({ taskId, audience, emails }: { taskId: string; audience: string; emails: string[] }) {
  const [state, action] = useActionState(setTaskAudience.bind(null, taskId), initial);
  const [choice, setChoice] = useState(state.values?.audience ?? audience);
  return (
    <form action={action} className="stack" noValidate>
      {state.done && state.message ? <Banner title={state.message} tone="positive" /> : null}
      {!state.done && state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ audience: "Who it is for", emails: "Learners" }} />
      <fieldset
        className="fieldset"
        onChange={(event) => setChoice((event.target as unknown as HTMLInputElement).value)}
      >
        <legend className="fieldset__legend">Who is this task for?</legend>
        <Radio defaultChecked={choice === "cohort"} label="Everyone in the cohort" name="audience" value="cohort" />
        <Radio
          defaultChecked={choice === "named"}
          help="For example, learners resitting a task."
          label="Named learners"
          name="audience"
          value="named"
        />
      </fieldset>
      {choice === "named" ? (
        <TextareaField
          defaultValue={state.values?.emails ?? emails.join("\n")}
          error={state.errors?.emails}
          help="One email address per line. Each learner must already be enrolled in this cohort."
          label="Learners"
          name="emails"
          rows={5}
        />
      ) : null}
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">Save audience</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Publishing is irreversible: learners see the task from here on, so it is a consequence dialog that states the
 * effect with the number of people affected.
 */
export function PublishTask({
  taskId,
  audienceSize,
  cohortName,
  dueAt,
}: {
  taskId: string;
  audienceSize: number;
  cohortName: string;
  dueAt: string | null;
}) {
  const [state, action] = useActionState(publishTask.bind(null, taskId), initial);
  const learners = audienceSize === 1 ? "1 learner" : `${audienceSize} learners`;
  return (
    <form action={action} className="stack" id="publish-task" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ConsequenceDialog
        cancelLabel="Not yet"
        confirmLabel="Publish this task"
        consequence={`${learners} in ${cohortName} will see this task straight away${
          dueAt ? `, due ${formatDateTime(dueAt)}` : ""
        }.`}
        form="publish-task"
        title="Publish this task?"
        trigger={{ label: "Publish" }}
      >
        <ul className="modal__list">
          <li>A published task cannot be edited. To change the work, set a new task.</li>
          <li>Notifications and calendar entries follow when that part is built.</li>
        </ul>
      </ConsequenceDialog>
    </form>
  );
}
