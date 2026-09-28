"use client";

import { useActionState, useState } from "react";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { fieldId, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Icon } from "@/components/ui/icons";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { concludeAppeal } from "./actions";
import { CATEGORY_STAFF_LABELS, outcomeCategory } from "./rules";

export interface ReviewCriterion {
  ordinal: number;
  title: string;
  descriptor: string | null;
  max_points: number | null;
  points: number | null;
  comment: string | null;
}

const LABELS = {
  outcome: "Outcome",
  reasons: "Your reasons",
  remediation: "What the learner must do",
  resubmissionDays: "Resubmission period",
  form: "Marks",
};

function total(criteria: ReviewCriterion[], points: Record<number, string>): number | null {
  const scored = criteria.filter((criterion) => criterion.max_points !== null);
  if (scored.length === 0) return null;
  return scored.reduce((sum, criterion) => sum + (Number(points[criterion.ordinal]) || 0), 0);
}

/**
 * R-02 conclusion (FR-610): mark the work again, choose the outcome, and give reasons the learner reads. Whether it is
 * upheld or amended follows from the marks, and is shown before it is recorded. The decision is final (FR-613).
 */
export function ConcludeForm({
  appealId,
  reference,
  learnerName,
  itemTitle,
  appealedOutcome,
  criteria,
  appealedRemediation,
  keptDeadline,
}: {
  appealId: string;
  reference: string;
  learnerName: string;
  itemTitle: string;
  appealedOutcome: "competent" | "not_yet_competent";
  criteria: ReviewCriterion[];
  appealedRemediation: string | null;
  /** "Monday 12 October 2026 at 13:37 (SAST)": what an upheld "not yet competent" keeps. */
  keptDeadline: string | null;
}) {
  const [state, action] = useActionState(concludeAppeal.bind(null, appealId), {} as FormState);
  const values = state.values ?? {};
  // One identifier for every retry of this conclusion, so a lost reply never records it twice.
  const [commandId] = useState(() => crypto.randomUUID());
  const [points, setPoints] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      criteria.map((criterion) => [
        criterion.ordinal,
        values[`points-${criterion.ordinal}`] ?? (criterion.points === null ? "" : String(criterion.points)),
      ]),
    ),
  );
  const [outcome, setOutcome] = useState(values.outcome ?? appealedOutcome);

  const possible = criteria.some((criterion) => criterion.max_points !== null)
    ? criteria.reduce((sum, criterion) => sum + (criterion.max_points ?? 0), 0)
    : null;
  const before = total(
    criteria,
    Object.fromEntries(criteria.map((criterion) => [criterion.ordinal, String(criterion.points ?? "")])),
  );
  const now = total(criteria, points);
  const category = outcomeCategory(appealedOutcome, before, outcome, now);
  const totalText = (value: number | null) => (value === null || possible === null ? "" : `, ${value} of ${possible}`);

  return (
    <form action={action} className="form" id="conclude-form" noValidate>
      <input name="commandId" type="hidden" value={commandId} />
      <input name="ordinals" type="hidden" value={criteria.map((criterion) => criterion.ordinal).join(",")} />
      <ErrorSummary errors={state.errors} labels={LABELS} />
      {state.message ? <Banner title={state.message} tone="critical" /> : null}

      <fieldset className="fieldset">
        <legend className="fieldset__legend">Your marks for each criterion</legend>
        <p className="text-small text-muted u-measure">
          Each criterion starts with the assessor&apos;s mark and comment. Change what you disagree with.
        </p>
        <div className="stack">
          {criteria.map((criterion) => (
            <div className="card" key={criterion.ordinal}>
              <div className="card__body stack stack--sm">
                <p>
                  <strong>
                    {criterion.ordinal}. {criterion.title}
                  </strong>
                  {criterion.descriptor ? (
                    <span className="text-small text-muted"> · {criterion.descriptor}</span>
                  ) : null}
                </p>
                <p className="text-small text-muted">
                  Assessor:{" "}
                  {criterion.max_points === null ? "not scored" : `${criterion.points ?? 0} of ${criterion.max_points}`}
                  {criterion.comment ? ` · "${criterion.comment}"` : ""}
                </p>
                <div
                  className="cluster"
                  onChange={(event) => {
                    const target = event.target as HTMLInputElement;
                    setPoints((current) => ({ ...current, [criterion.ordinal]: target.value }));
                  }}
                >
                  {criterion.max_points === null ? (
                    <input name={`points-${criterion.ordinal}`} type="hidden" value="" />
                  ) : (
                    <TextField
                      defaultValue={points[criterion.ordinal]}
                      help={`0 to ${criterion.max_points}`}
                      label={`Your mark for ${criterion.title}`}
                      name={`points-${criterion.ordinal}`}
                    />
                  )}
                </div>
                <TextareaField
                  defaultValue={values[`comment-${criterion.ordinal}`] ?? criterion.comment ?? ""}
                  label={`Your comment on ${criterion.title}`}
                  name={`comment-${criterion.ordinal}`}
                  optional
                  rows={2}
                />
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <div id={fieldId("outcome")}>
        <ChoiceGroup columns={2} legend="Outcome">
          <Choice
            checked={outcome === "competent"}
            name="outcome"
            onChange={() => setOutcome("competent")}
            title={OUTCOME_LABELS.competent}
            tone="positive"
            value="competent"
          />
          <Choice
            checked={outcome === "not_yet_competent"}
            name="outcome"
            onChange={() => setOutcome("not_yet_competent")}
            title={OUTCOME_LABELS.not_yet_competent}
            tone="caution"
            value="not_yet_competent"
          />
        </ChoiceGroup>
        {state.errors?.outcome ? (
          <p className="field__error">
            <Icon className="icon icon--sm" name="alert-circle" />
            {state.errors.outcome}
          </p>
        ) : null}
      </div>

      <Banner
        icon="scales"
        role="status"
        title={`This will be recorded as: ${CATEGORY_STAFF_LABELS[category]}`}
        tone="info"
      >
        <p>
          The decision appealed was {OUTCOME_LABELS[appealedOutcome]}
          {totalText(before)}. Yours is {OUTCOME_LABELS[outcome]}
          {totalText(now)}.
        </p>
      </Banner>

      {outcome === "not_yet_competent" ? (
        <>
          <TextareaField
            defaultValue={values.remediation ?? appealedRemediation ?? ""}
            error={state.errors?.remediation}
            help="The learner reads this as what to do next."
            label={LABELS.remediation}
            name="remediation"
            rows={3}
          />
          {category === "upheld" && keptDeadline ? (
            <p className="text-small text-muted">
              The appeal is upheld, so {learnerName} keeps the resubmission deadline they already have: {keptDeadline}.
            </p>
          ) : (
            <TextField
              defaultValue={values.resubmissionDays ?? "14"}
              error={state.errors?.resubmissionDays}
              help="Days from today, 1 to 90. The learner is told the date."
              label={LABELS.resubmissionDays}
              name="resubmissionDays"
            />
          )}
        </>
      ) : null}

      <TextareaField
        defaultValue={values.reasons}
        error={state.errors?.reasons}
        feedback
        help={`${learnerName} reads these word for word. Say what you found, criterion by criterion. Your name is not shown to the learner.`}
        label={LABELS.reasons}
        name="reasons"
        rows={6}
      />

      <div className="form__actions">
        {outcome ? (
          <ConsequenceDialog
            acknowledgement="I took no assessment decision on this work."
            cancelLabel="Go back"
            confirmLabel="Record final decision"
            consequence={`This decision is final. There is no further appeal. It is released to ${learnerName} at once.`}
            form="conclude-form"
            title={`Record the decision on appeal ${reference}?`}
            trigger={{ label: "Record decision" }}
          >
            <ul className="modal__list">
              <li>
                Recorded as {CATEGORY_STAFF_LABELS[category].toLowerCase()}: {OUTCOME_LABELS[outcome]}
                {totalText(now)} for {itemTitle}.
              </li>
              <li>The decision appealed stays on record. Nothing is edited or deleted.</li>
              <li>{learnerName}, the assessor and the coordinator are told.</li>
            </ul>
          </ConsequenceDialog>
        ) : (
          <SubmitButton pendingLabel="Recording the decision">Record decision</SubmitButton>
        )}
      </div>
    </form>
  );
}
