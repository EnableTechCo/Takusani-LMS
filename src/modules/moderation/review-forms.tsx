"use client";

import { useActionState, useState } from "react";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { ConflictPanel } from "@/components/ui/conflict";
import { SelectField, TextareaField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { reallocateItem, recordFinding, recordObservation } from "./review-actions";
import { conflictText } from "./review-rules";

const initial: FormState = {};

/**
 * M-03 (FR-508): agree or disagree with the assessor's decision, with reasons either way. A finding is never edited;
 * each one is added to the item's history. Return for re-marking follows a disagreement (S4-08).
 */
export function FindingForm({
  cycleId,
  itemId,
  moderatorName,
  revised,
}: {
  cycleId: string;
  itemId: string;
  moderatorName: string;
  /** The decision under review replaced an earlier one (after a re-mark). */
  revised: boolean;
}) {
  const [state, action] = useActionState(recordFinding.bind(null, cycleId, itemId), initial);
  const values = state.values ?? {};
  const [finding, setFinding] = useState(values.finding ?? "");
  return (
    <form action={action} className="stack" id="ws-finding" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ finding: "Your finding", reasons: "Reasons" }} />
      <div onChange={(event) => setFinding((event.target as HTMLInputElement).value)}>
        <ChoiceGroup columns={2} legend={`Do you agree with the assessor's ${revised ? "revised " : ""}decision?`}>
          <Choice
            defaultChecked={finding === "agree"}
            description="The marks and the outcome are supported by the evidence."
            name="finding"
            title="Agree"
            tone="positive"
            value="agree"
          />
          <Choice
            defaultChecked={finding === "disagree"}
            description="Something must be corrected. The coordinator and the assessor can read your reasons."
            name="finding"
            title="Disagree"
            tone="caution"
            value="disagree"
          />
        </ChoiceGroup>
      </div>
      <TextareaField
        defaultValue={values.reasons}
        error={state.errors?.reasons}
        help="Refer to the criteria and to the evidence. The assessor and the coordinator can read this. The learner cannot."
        label="Reasons"
        name="reasons"
        rows={5}
      />
      {finding === "disagree" ? (
        <p className="text-small text-muted">
          Returning the item to the assessor with required corrections and a deadline arrives with the next release.
          Your disagreement is recorded now and the item stays open.
        </p>
      ) : null}
      <div className="cluster cluster--between">
        <span className="text-small text-muted">You are recording this finding as the moderator: {moderatorName}</span>
        <SubmitButton pendingLabel="Recording">Record finding</SubmitButton>
      </div>
    </form>
  );
}

/** M-02 (FR-508): a cohort-level observation for the coordinator, added to the cycle. */
export function ObservationForm({ cycleId }: { cycleId: string }) {
  const [state, action] = useActionState(recordObservation.bind(null, cycleId), initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.done ? <Banner compact role="status" title="Observation recorded" tone="positive" /> : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <TextareaField
        error={state.errors?.body}
        help="About the cohort's assessment as a whole, not one item: patterns across assessors, criteria that are read differently, evidence that is often thin. The coordinator reads these."
        label="Observation"
        name="body"
        rows={4}
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Recording">Add observation</SubmitButton>
      </div>
    </form>
  );
}

/**
 * C-07 (FR-504): move an item to another moderator. A candidate who assessed the result is listed but cannot be
 * chosen; if the server still refuses, the conflict is shown with the decision named (BR-01).
 */
export function ReallocateForm({
  cohortId,
  cycleId,
  itemId,
  candidates,
}: {
  cohortId: string;
  cycleId: string;
  itemId: string;
  candidates: {
    profile_id: string;
    full_name: string;
    conflict: boolean;
    holds_now: boolean;
    items_in_cycle: number;
  }[];
}) {
  const [state, action] = useActionState(reallocateItem.bind(null, cohortId, cycleId, itemId), initial);
  const values = state.values ?? {};
  const conflict = values.conflict
    ? (JSON.parse(values.conflict) as { actor_name?: string; outcome?: string; decided_at?: string }[])
    : null;
  const eligible = candidates.filter((candidate) => !candidate.conflict && !candidate.holds_now);
  return (
    <form action={action} className="stack" noValidate>
      {conflict ? (
        <ConflictPanel
          evidence={[{ term: "Conflicting decision", detail: conflictText(conflict, formatDateTime) }]}
          rule="BR-01 · separation_of_duties_conflict"
          title="This would break separation of duties"
        >
          {state.message}
        </ConflictPanel>
      ) : state.message ? (
        <Banner title={state.message} tone="critical" />
      ) : null}
      {eligible.length === 0 ? (
        <p className="text-small text-muted">
          Nobody else can take this item: every other moderator of the cohort assessed it.
        </p>
      ) : (
        <>
          <SelectField
            defaultValue={values.moderatorId}
            error={state.errors?.moderatorId}
            help={
              candidates.some((candidate) => candidate.conflict)
                ? `Not listed: ${candidates
                    .filter((candidate) => candidate.conflict)
                    .map((candidate) => candidate.full_name)
                    .join(", ")}, who assessed this result.`
                : undefined
            }
            label="Move to"
            name="moderatorId"
            options={eligible.map((candidate) => ({
              value: candidate.profile_id,
              label: `${candidate.full_name} (${candidate.items_in_cycle} in this cycle)`,
            }))}
            placeholder="Choose a moderator"
          />
          <div className="cluster">
            <SubmitButton pendingLabel="Moving">Reallocate</SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}
