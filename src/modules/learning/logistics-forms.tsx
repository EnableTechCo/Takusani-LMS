"use client";

import { useActionState, useState } from "react";
import { Checkbox, Fieldset } from "@/components/ui/choice";
import { TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { reconcileVariance, saveLogistics } from "./logistics-actions";

const initial: FormState = {};

export interface LogisticsValues {
  venue: string;
  venueNote: string | null;
  venueArranged: boolean;
  cateringNeeded: boolean;
  headcount: number | null;
  dietary: string | null;
  cateringArranged: boolean;
  equipment: string | null;
  equipmentArranged: boolean;
}

/**
 * C-11 (FR-705): the venue booking, catering and equipment for one in-person session, each marked arranged. Catering
 * starts from the default headcount (FR-706); the page says where that number came from.
 */
export function LogisticsForm({
  sessionId,
  version,
  saved,
  defaultHeadcount,
  arrangedBy,
}: {
  sessionId: string;
  version: number;
  saved: LogisticsValues;
  defaultHeadcount: number;
  /** "Arranged by Ayesha Patel, 26 Oct 2026, 10:12" per item, when it is. */
  arrangedBy: { venue: string | null; catering: string | null; equipment: string | null };
}) {
  const [state, action] = useActionState(saveLogistics.bind(null, sessionId, version), initial);
  const [catering, setCatering] = useState(saved.cateringNeeded);
  const values = state.done ? {} : (state.values ?? {});
  return (
    <form action={action} className="stack stack--lg" noValidate>
      {state.done ? <Banner compact role="status" title="Logistics saved" tone="positive" /> : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ headcount: "Catering headcount", equipment: "Equipment" }} />

      <Fieldset legend={`Venue: ${saved.venue}`}>
        <TextareaField
          defaultValue={values.venueNote ?? saved.venueNote ?? ""}
          help="The booking, for example who confirmed the room and the reference."
          label="Booking note"
          name="venueNote"
          optional
          rows={2}
        />
        <Checkbox
          defaultChecked={saved.venueArranged}
          help={arrangedBy.venue ?? undefined}
          label="Venue arranged"
          name="venueArranged"
        />
      </Fieldset>

      <Fieldset legend="Catering">
        <div
          onChange={(event) => {
            const input = event.target as HTMLInputElement;
            if (input.name === "cateringNeeded") setCatering(input.checked);
          }}
        >
          <Checkbox defaultChecked={saved.cateringNeeded} label="Catering is needed" name="cateringNeeded" />
        </div>
        {catering ? (
          <>
            <TextField
              defaultValue={values.headcount ?? String(saved.headcount ?? defaultHeadcount)}
              error={state.errors?.headcount}
              help="How many to cater for. It starts from the default shown beside this form."
              inputMode="numeric"
              label="Catering headcount"
              name="headcount"
              type="number"
            />
            <TextareaField
              defaultValue={values.dietary ?? saved.dietary ?? ""}
              label="Dietary requirements"
              name="dietary"
              optional
              rows={2}
            />
            <Checkbox
              defaultChecked={saved.cateringArranged}
              help={arrangedBy.catering ?? undefined}
              label="Catering arranged"
              name="cateringArranged"
            />
          </>
        ) : null}
      </Fieldset>

      <Fieldset legend="Equipment">
        <TextareaField
          defaultValue={values.equipment ?? saved.equipment ?? ""}
          error={state.errors?.equipment}
          help="For example a projector or laptops. Leave it empty when nothing is needed."
          label="Equipment needed"
          name="equipment"
          optional
          rows={2}
        />
        <Checkbox
          defaultChecked={saved.equipmentArranged}
          help={arrangedBy.equipment ?? undefined}
          label="Equipment arranged"
          name="equipmentArranged"
        />
      </Fieldset>

      <div className="form__actions">
        <SubmitButton pendingLabel="Saving">Save logistics</SubmitButton>
      </div>
    </form>
  );
}

/** FR-707: reconciling a flagged difference between the learners present and the confirmed headcount. */
export function ReconcileForm({ sessionId }: { sessionId: string }) {
  const [state, action] = useActionState(reconcileVariance.bind(null, sessionId), initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <TextareaField
        defaultValue={state.values?.note}
        error={state.errors?.note}
        help="What happened, and what was done about it, for example the caterer's invoice."
        label="Reconciliation note"
        name="note"
        rows={3}
      />
      <div className="form__actions">
        <SubmitButton pendingLabel="Saving">Reconcile</SubmitButton>
      </div>
    </form>
  );
}
