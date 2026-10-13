"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { Field, SelectField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import {
  addQualification,
  addUnit,
  applyUnitList,
  checkUnitList,
  createProgrammeForStructure,
  editQualification,
  editUnit,
  removeQualification,
  removeUnit,
  type UnitImportState,
} from "./structure-actions";
import { importDoneText, importPreviewText, rowProblemText } from "./structure-rules";

const initial: FormState = {};

const CODE_HELP = "2 to 32 letters, digits or hyphens, for example U3 or 119465. Saved in capitals.";

/** A new programme, from Administration; it opens once created, ready for its qualifications and units. */
export function NewProgrammeStructureForm() {
  const [state, action] = useActionState(createProgrammeForStructure, initial);
  const labels = { code: "Programme code", title: "Programme title", nqfLevel: "NQF level" };
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={labels} />
      <TextField
        defaultValue={state.values?.code}
        error={state.errors?.code}
        help="A short, unique reference, for example CBA-NQF4."
        label={labels.code}
        name="code"
      />
      <TextField defaultValue={state.values?.title} error={state.errors?.title} label={labels.title} name="title" />
      <TextField
        defaultValue={state.values?.nqfLevel}
        error={state.errors?.nqfLevel}
        help="1 to 10."
        inputMode="numeric"
        label={labels.nqfLevel}
        name="nqfLevel"
        optional
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Creating programme">Create programme</SubmitButton>
      </div>
    </form>
  );
}

export function AddQualificationForm({ programmeId }: { programmeId: string }) {
  const [state, action] = useActionState(addQualification.bind(null, programmeId), initial);
  const labels = { code: "Qualification code", title: "Qualification title" };
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={labels} />
      <TextField
        defaultValue={state.values?.code}
        error={state.errors?.code}
        help={`Its SAQA qualification ID or your own reference. ${CODE_HELP}`}
        label={labels.code}
        name="code"
      />
      <TextField defaultValue={state.values?.title} error={state.errors?.title} label={labels.title} name="title" />
      <div className="cluster">
        <SubmitButton pendingLabel="Adding">Add qualification</SubmitButton>
      </div>
    </form>
  );
}

export function AddUnitForm({
  programmeId,
  qualifications,
}: {
  programmeId: string;
  qualifications: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(addUnit.bind(null, programmeId), initial);
  const labels = { qualificationId: "Qualification", code: "Unit code", title: "Unit title", credits: "Credits" };
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={labels} />
      <SelectField
        defaultValue={
          state.values?.qualificationId ?? (qualifications.length === 1 ? qualifications[0].value : undefined)
        }
        error={state.errors?.qualificationId}
        label={labels.qualificationId}
        name="qualificationId"
        options={qualifications}
        placeholder="Choose a qualification"
      />
      <TextField
        defaultValue={state.values?.code}
        error={state.errors?.code}
        help={`Its unit standard ID or your own reference. ${CODE_HELP}`}
        label={labels.code}
        name="code"
      />
      <TextField defaultValue={state.values?.title} error={state.errors?.title} label={labels.title} name="title" />
      <TextField
        defaultValue={state.values?.credits}
        error={state.errors?.credits}
        help="A whole number from 0 to 1000. Every unit is compulsory, so it adds to the qualification's total."
        inputMode="numeric"
        label={labels.credits}
        name="credits"
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Adding">Add unit</SubmitButton>
      </div>
    </form>
  );
}

/** Corrects a code or title in place; the credit value has its own versioned change, under Configuration. */
export function EditQualificationForm({
  programmeId,
  qualification,
}: {
  programmeId: string;
  qualification: { qualification_id: string; code: string; title: string };
}) {
  const [state, action] = useActionState(
    editQualification.bind(null, programmeId, qualification.qualification_id),
    initial,
  );
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <TextField
        defaultValue={state.values?.code ?? qualification.code}
        error={state.errors?.code}
        label="Qualification code"
        name="code"
      />
      <TextField
        defaultValue={state.values?.title ?? qualification.title}
        error={state.errors?.title}
        label="Qualification title"
        name="title"
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">Save qualification</SubmitButton>
      </div>
    </form>
  );
}

export function EditUnitForm({
  programmeId,
  unit,
}: {
  programmeId: string;
  unit: { unit_id: string; code: string; title: string };
}) {
  const [state, action] = useActionState(editUnit.bind(null, programmeId, unit.unit_id), initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <TextField
        defaultValue={state.values?.code ?? unit.code}
        error={state.errors?.code}
        label="Unit code"
        name="code"
      />
      <TextField
        defaultValue={state.values?.title ?? unit.title}
        error={state.errors?.title}
        label="Unit title"
        name="title"
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">Save unit</SubmitButton>
        <Link className="link" href={`/admin/configuration/units/${unit.unit_id}`}>
          Change its credit value
        </Link>
      </div>
    </form>
  );
}

/** Removes a unit nothing refers to yet, after saying so; the database refuses one in use. */
export function RemoveUnitForm({
  programmeId,
  unit,
}: {
  programmeId: string;
  unit: { unit_id: string; code: string };
}) {
  const [state, action] = useActionState(() => removeUnit(programmeId, unit.unit_id), initial);
  const formId = `remove-unit-${unit.unit_id}`;
  return (
    <form action={action} className="stack" id={formId}>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <div>
        <ConsequenceDialog
          cancelLabel="Keep it"
          confirmLabel="Remove unit"
          consequence={`Unit ${unit.code} is removed from the programme, with its credit value. Use this for a unit added by mistake: nothing refers to it yet.`}
          form={formId}
          title={`Remove unit ${unit.code}?`}
          trigger={{ label: "Remove unit", variant: "secondary" }}
        />
      </div>
    </form>
  );
}

export function RemoveQualificationForm({
  programmeId,
  qualification,
}: {
  programmeId: string;
  qualification: { qualification_id: string; code: string };
}) {
  const [state, action] = useActionState(
    () => removeQualification(programmeId, qualification.qualification_id),
    initial,
  );
  return (
    <form action={action} className="stack">
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <div>
        <Button type="submit" variant="secondary">
          Remove qualification {qualification.code}
        </Button>
      </div>
    </form>
  );
}

const noImport: UnitImportState = {};

/**
 * Imports a unit list in two steps: check the file (every line, nothing added), then import it (the database checks
 * it again and adds it all, or nothing). Units already in the programme are left as they are.
 */
export function ImportUnitListForm({ programmeId }: { programmeId: string }) {
  const [checked, check] = useActionState(checkUnitList.bind(null, programmeId), noImport);
  const [applied, apply] = useActionState(applyUnitList.bind(null, programmeId), noImport);
  const result = checked.check;

  if (applied.imported) {
    return (
      <Banner role="status" title="Unit list imported" tone="positive">
        <p>{importDoneText(applied.imported)}</p>
      </Banner>
    );
  }

  return (
    <div className="stack">
      <form action={check} className="stack" encType="multipart/form-data" noValidate>
        {checked.message ? <Banner title={checked.message} tone="critical" /> : null}
        <ErrorSummary errors={checked.errors} labels={{ file: "Unit list" }} />
        <Field
          error={checked.errors?.file}
          help="A CSV file, up to 500 KB and 1,000 units. The first row names the columns."
          label="Unit list"
          name="file"
        >
          {(control) => <input {...control} accept=".csv,text/csv" className="input" type="file" />}
        </Field>
        <div className="cluster">
          <SubmitButton pendingLabel="Checking the file">
            {result ? "Check another file" : "Check the file"}
          </SubmitButton>
        </div>
      </form>

      {result ? (
        result.problems.length > 0 ? (
          <Banner title={`${result.fileName}: nothing can be imported until these lines are fixed`} tone="critical">
            <ul>
              {result.problems.map((problem) => (
                <li key={`${problem.row}-${problem.problem}`}>
                  Line {problem.row}: {rowProblemText(problem)}
                </li>
              ))}
            </ul>
          </Banner>
        ) : (
          <form action={apply} className="stack">
            {applied.message ? <Banner title={applied.message} tone="critical" /> : null}
            <Banner title={`${result.fileName} is ready`} tone="info">
              <p>
                {importPreviewText({
                  newQualifications: result.newQualifications,
                  newUnits: result.newUnits,
                  skipped: result.skipped.length,
                })}
              </p>
              {result.skipped.some((unit) => unit.differs) ? (
                <p>
                  Already in the programme with a different title or credit value, and left unchanged:{" "}
                  {result.skipped
                    .filter((unit) => unit.differs)
                    .map((unit) => `${unit.unit_code} (line ${unit.row})`)
                    .join(", ")}
                  . Change those on this page.
                </p>
              ) : null}
            </Banner>
            <input name="rows" type="hidden" value={result.rows} />
            {result.newUnits > 0 ? (
              <div className="cluster">
                <SubmitButton pendingLabel="Importing">
                  Import {result.newUnits} {result.newUnits === 1 ? "unit" : "units"}
                </SubmitButton>
              </div>
            ) : null}
          </form>
        )
      ) : null}
    </div>
  );
}
