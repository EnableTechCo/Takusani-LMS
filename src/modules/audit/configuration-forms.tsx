"use client";

import { useActionState, useState } from "react";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import { formatLongDayOf } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { recordVersion, setUnitCredits } from "./configuration-actions";
import { valueText, type Choice, type SettingShape } from "./configuration-rules";

const LABELS = { value: "New value", effectiveOn: "Takes effect", reason: "Reason" };

/** Today in South Africa, as a date input's value. */
function sastToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());
}

function whenText(date: string): string {
  if (!date) return "a day you choose";
  return date === sastToday() ? "now" : `the start of ${formatLongDayOf(`${date}T00:00:00+02:00`)}`;
}

/**
 * X-06 record a new value (FR-108, FR-109). A value is never edited: this records the next version, with the day it
 * takes effect and the reason. The dialog says what the change affects and, before anything is recorded, that
 * nothing already under way changes.
 */
export function NewValueForm({
  settingKey,
  label,
  setting,
  min,
  max,
  current,
  nextVersion,
  affects,
  doesNotAffect,
}: {
  settingKey: string;
  label: string;
  setting: SettingShape;
  min: number | null;
  max: number | null;
  current: unknown;
  nextVersion: number;
  affects: string;
  doesNotAffect: string;
}) {
  const [state, action] = useActionState(recordVersion.bind(null, settingKey), {} as FormState);
  const values = state.values ?? {};
  const [value, setValue] = useState(values.value ?? "");
  const [effectiveOn, setEffectiveOn] = useState(values.effectiveOn ?? sastToday());
  const formId = "new-value-form";
  const newText = value ? valueText(setting, setting.value_type === "integer" ? Number(value) : value) : "";

  return (
    <form action={action} className="form" id={formId} noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LABELS} />
      <div className="form__row form__row--2">
        <div onChange={(event) => setValue((event.target as HTMLInputElement).value)}>
          {setting.value_type === "choice" ? (
            <SelectField
              defaultValue={values.value}
              error={state.errors?.value}
              help={`In force now: ${valueText(setting, current)}.`}
              label={LABELS.value}
              name="value"
              options={(setting.choices ?? []).map((choice: Choice) => ({ value: choice.value, label: choice.label }))}
              placeholder="Choose a value"
            />
          ) : (
            <TextField
              defaultValue={values.value}
              error={state.errors?.value}
              help={`A whole number from ${min} to ${max}. In force now: ${valueText(setting, current)}.`}
              label={`${LABELS.value}${setting.unit_label ? `, in ${setting.unit_label === "%" ? "percent" : setting.unit_label}` : ""}`}
              name="value"
              type="number"
            />
          )}
        </div>
        <div onChange={(event) => setEffectiveOn((event.target as HTMLInputElement).value)}>
          <TextField
            defaultValue={effectiveOn}
            error={state.errors?.effectiveOn}
            help="Today for a change now, or a later day, from its start. It cannot be in the past."
            label={LABELS.effectiveOn}
            name="effectiveOn"
            type="date"
          />
        </div>
      </div>
      <TextareaField
        defaultValue={values.reason}
        error={state.errors?.reason}
        help="Kept with the version for auditors. Say who asked for the change and quote their reference."
        label={LABELS.reason}
        name="reason"
        rows={3}
      />
      <div className="form__actions">
        <ConsequenceDialog
          cancelLabel="Go back"
          confirmLabel={`Record version ${nextVersion}`}
          consequence={`${label} becomes ${newText || "the new value"} from ${whenText(effectiveOn)}. It applies to ${affects.charAt(0).toLowerCase()}${affects.slice(1)}`}
          form={formId}
          title={`Record version ${nextVersion} of ${label}?`}
          trigger={{ label: "Review the change" }}
        >
          <ul className="modal__list">
            <li>{doesNotAffect}</li>
            <li>Version {nextVersion - 1} stays on record with who recorded it. Nothing is edited or deleted.</li>
          </ul>
        </ConsequenceDialog>
      </div>
    </form>
  );
}

/** A unit's credit value (FR-108): effective-dated, with a reason, never an edit. */
export function UnitCreditForm({
  unitId,
  unitTitle,
  current,
}: {
  unitId: string;
  unitTitle: string;
  current: number | null;
}) {
  const [state, action] = useActionState(setUnitCredits.bind(null, unitId), {} as FormState);
  const values = state.values ?? {};
  const [value, setValue] = useState(values.value ?? "");
  const [effectiveOn, setEffectiveOn] = useState(values.effectiveOn ?? sastToday());
  return (
    <form action={action} className="form" id="unit-credit-form" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LABELS} />
      <div className="form__row form__row--2">
        <div onChange={(event) => setValue((event.target as HTMLInputElement).value)}>
          <TextField
            defaultValue={values.value}
            error={state.errors?.value}
            help={`A whole number from 0 to 1000. In force now: ${current ?? "none"} credits.`}
            label="New value, in credits"
            name="value"
            type="number"
          />
        </div>
        <div onChange={(event) => setEffectiveOn((event.target as HTMLInputElement).value)}>
          <TextField
            defaultValue={effectiveOn}
            error={state.errors?.effectiveOn}
            help="Today for a change now, or a later day, from its start."
            label={LABELS.effectiveOn}
            name="effectiveOn"
            type="date"
          />
        </div>
      </div>
      <TextareaField
        defaultValue={values.reason}
        error={state.errors?.reason}
        help="Kept with the value for auditors, for example the registration notice it comes from."
        label={LABELS.reason}
        name="reason"
        rows={3}
      />
      <div className="form__actions">
        <ConsequenceDialog
          cancelLabel="Go back"
          confirmLabel="Record the new value"
          consequence={`${unitTitle} is worth ${value || "the new number of"} credits from ${whenText(effectiveOn)}.`}
          form="unit-credit-form"
          title={`Change the credit value of ${unitTitle}?`}
          trigger={{ label: "Review the change" }}
        >
          <ul className="modal__list">
            <li>Credits already awarded keep the value they were awarded with.</li>
            <li>The earlier value stays on record. Nothing is edited or deleted.</li>
          </ul>
        </ConsequenceDialog>
      </div>
    </form>
  );
}
