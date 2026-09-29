"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Fieldset } from "@/components/ui/choice";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { discardRequirementDraft, freezeRequirementSet, saveRequirementDraft } from "./requirement-actions";
import { pairName, type RequirementItem, type RequirementPair, type RequirementUnit } from "./requirement-rules";

const initial: FormState = {};

/**
 * The draft: for each unit of the programme, the cohort's assessments it requires (P-07). One assessment may count
 * towards several units. Saving changes nothing for learners; freezing does.
 */
export function RequirementDraftForm({
  cohortId,
  units,
  items,
  chosen,
}: {
  cohortId: string;
  units: RequirementUnit[];
  items: RequirementItem[];
  chosen: RequirementPair[];
}) {
  const [state, action] = useActionState(saveRequirementDraft.bind(null, cohortId), initial);
  const ticked = new Set(chosen.map((pair) => pairName(pair.unit_id, pair.assessable_item_id)));
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      {units.map((unit) => (
        <Fieldset
          key={unit.unit_id}
          legend={
            <>
              {unit.code}: {unit.title}{" "}
              <span className="text-muted">
                ({unit.credits === null ? "no credit value yet" : `${unit.credits} credits`})
              </span>
            </>
          }
        >
          {items.map((item) => (
            <Checkbox
              defaultChecked={ticked.has(pairName(unit.unit_id, item.item_id))}
              help={item.suggested_unit_id === unit.unit_id ? "Its module belongs to this unit." : undefined}
              key={item.item_id}
              label={item.title}
              name={pairName(unit.unit_id, item.item_id)}
            />
          ))}
        </Fieldset>
      ))}
      <p className="text-small text-muted">
        Saving keeps this as a draft. Nothing is awarded until the draft is frozen.
      </p>
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">Save draft</SubmitButton>
      </div>
    </form>
  );
}

/** Freezes the draft; a change to the version in force needs a reason. */
export function FreezeRequirementsForm({
  cohortId,
  requirementSetId,
  version,
  changing,
  consequence,
}: {
  cohortId: string;
  requirementSetId: string;
  version: number;
  changing: boolean;
  consequence: string;
}) {
  const [state, action] = useActionState(freezeRequirementSet.bind(null, cohortId, requirementSetId), initial);
  const formId = `freeze-${requirementSetId}`;
  return (
    <form action={action} className="stack" id={formId} noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ reason: "Why the requirements are changing" }} />
      {changing ? (
        <TextareaField
          defaultValue={state.values?.reason}
          error={state.errors?.reason}
          help="Kept with the version and in the audit log. Awards already made stand."
          label="Why the requirements are changing"
          name="reason"
          rows={3}
        />
      ) : null}
      <div className="cluster">
        <ConsequenceDialog
          cancelLabel="Not yet"
          confirmLabel={`Freeze version ${version}`}
          consequence={consequence}
          form={formId}
          title={`Freeze version ${version}?`}
          trigger={{ label: `Freeze version ${version}` }}
        />
      </div>
    </form>
  );
}

export function DiscardDraftForm({ cohortId }: { cohortId: string }) {
  const [state, action] = useActionState(() => discardRequirementDraft(cohortId), initial);
  return (
    <form action={action} className="stack">
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <div>
        <Button type="submit" variant="secondary">
          Discard the draft
        </Button>
      </div>
    </form>
  );
}
