"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { concludeCorrection, proposeCorrection, withdrawCorrection } from "./correction-actions";

const initial: FormState = {};

const LABELS = {
  resultId: "Result to correct",
  outcome: "Outcome that should stand",
  justification: "Justification for the corrected outcome",
  reason: "Why the released outcome was wrong",
  remediation: "What the learner must do",
  resubmissionDays: "Days to resubmit",
};

export interface CorrectableOption {
  result_id: string;
  label: string;
  outcome: string;
  disabled: string | null;
}

/**
 * C-14 (P-12): propose a correction of a released result. The outcome must change; the justification is the
 * learner's to read, the reason is for the approver and the record. A second person approves.
 */
export function ProposeCorrectionForm({ options }: { options: CorrectableOption[] }) {
  const [state, action] = useActionState(proposeCorrection, initial);
  const values = state.values ?? {};
  const [outcome, setOutcome] = useState(values.outcome ?? "");
  const [resultId, setResultId] = useState(values.resultId ?? "");
  const chosen = options.find((option) => option.result_id === resultId);

  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LABELS} />
      <div onChange={(event) => setResultId((event.target as unknown as HTMLSelectElement).value)}>
        <SelectField
          defaultValue={values.resultId}
          error={state.errors?.resultId}
          help="Released results of the cohort. One decided on appeal, or waiting for moderation, cannot be corrected here."
          label={LABELS.resultId}
          name="resultId"
          options={options.map((option) => ({
            value: option.result_id,
            label: option.disabled ? `${option.label} (${option.disabled})` : option.label,
            disabled: option.disabled !== null,
          }))}
          placeholder="Choose a result"
        />
      </div>
      <div onChange={(event) => setOutcome((event.target as HTMLInputElement).value)}>
        <ChoiceGroup columns={2} legend={LABELS.outcome}>
          <Choice
            defaultChecked={outcome === "competent"}
            description={
              chosen?.outcome === "competent"
                ? "Already released: choose the other outcome."
                : "The evidence meets every criterion."
            }
            name="outcome"
            title="Competent"
            tone="positive"
            value="competent"
          />
          <Choice
            defaultChecked={outcome === "not_yet_competent"}
            description={
              chosen?.outcome === "not_yet_competent"
                ? "Already released: choose the other outcome."
                : "Something is missing; the learner is told what to do."
            }
            name="outcome"
            title="Not yet competent"
            tone="caution"
            value="not_yet_competent"
          />
        </ChoiceGroup>
      </div>
      {state.errors?.outcome ? <p className="field__error">{state.errors.outcome}</p> : null}
      <TextareaField
        defaultValue={values.justification}
        error={state.errors?.justification}
        help="Against the criteria, as for any decision. The learner reads it with the corrected outcome."
        label={LABELS.justification}
        name="justification"
        rows={4}
      />
      {outcome === "not_yet_competent" ? (
        <>
          <TextareaField
            defaultValue={values.remediation}
            error={state.errors?.remediation}
            help="The actions the learner must take to reach competence."
            label={LABELS.remediation}
            name="remediation"
            rows={3}
          />
          <TextField
            defaultValue={values.resubmissionDays}
            error={state.errors?.resubmissionDays}
            help="Counted from the day the correction is approved and released. Between 1 and 90."
            inputMode="numeric"
            label={LABELS.resubmissionDays}
            name="resubmissionDays"
            type="number"
          />
        </>
      ) : null}
      <TextareaField
        defaultValue={values.reason}
        error={state.errors?.reason}
        help="What went wrong with the released outcome, for the person who approves and for the record. The learner does not read this."
        label={LABELS.reason}
        name="reason"
        rows={3}
      />
      <p className="text-small text-muted">
        Nothing changes for the learner until a second person approves: another coordinator of the cohort or an
        administrator, who took no decision on the result.
      </p>
      <div className="cluster">
        <SubmitButton pendingLabel="Proposing">Propose correction</SubmitButton>
      </div>
    </form>
  );
}

/** C-14: the second person approves, releasing the corrected outcome, or declines with a reason. */
export function ConcludeCorrectionForm({
  base,
  correctionId,
  consequence,
}: {
  /** The workspace route the page returns to: /coordinate/corrections or /admin/corrections. */
  base: string;
  correctionId: string;
  consequence: string;
}) {
  const [state, action] = useActionState(concludeCorrection.bind(null, base, correctionId), initial);
  const values = state.values ?? {};
  const [decision, setDecision] = useState(values.decision ?? "");
  const formId = `conclude-${correctionId}`;
  return (
    <form action={action} className="stack" id={formId} noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ decision: "Your decision", reason: "Reason for declining" }} />
      <div onChange={(event) => setDecision((event.target as HTMLInputElement).value)}>
        <ChoiceGroup columns={2} legend="Your decision">
          <Choice
            defaultChecked={decision === "approve"}
            description="The corrected outcome is released to the learner now."
            name="decision"
            title="Approve"
            tone="positive"
            value="approve"
          />
          <Choice
            defaultChecked={decision === "decline"}
            description="The released outcome stands. The proposer is told why."
            name="decision"
            title="Decline"
            tone="caution"
            value="decline"
          />
        </ChoiceGroup>
      </div>
      {decision === "decline" ? (
        <TextareaField
          defaultValue={values.reason}
          error={state.errors?.reason}
          help="The proposer reads this. It is kept with the correction."
          label="Reason for declining"
          name="reason"
          rows={3}
        />
      ) : null}
      <div className="cluster">
        {decision === "approve" ? (
          <ConsequenceDialog
            cancelLabel="Not yet"
            confirmLabel="Approve and release"
            consequence={consequence}
            form={formId}
            title="Approve this correction?"
            trigger={{ label: "Approve and release" }}
          />
        ) : (
          <SubmitButton pendingLabel="Recording">Record decision</SubmitButton>
        )}
      </div>
    </form>
  );
}

/** The proposer withdraws an open proposal. */
export function WithdrawCorrectionForm({ correctionId }: { correctionId: string }) {
  const [state, action] = useActionState(() => withdrawCorrection(correctionId), initial);
  return (
    <form action={action} className="stack">
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <div>
        <Button type="submit" variant="secondary">
          Withdraw this proposal
        </Button>
      </div>
    </form>
  );
}
