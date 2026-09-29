"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Choice, ChoiceGroup, Fieldset, Radio } from "@/components/ui/choice";
import { ConflictPanel } from "@/components/ui/conflict";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { TextLink } from "@/components/ui/link";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { cancelCycle, freezeCycle, planCycle } from "./cycle-actions";
import { CYCLE_STATE_LABELS, type CycleState, type PoolRow } from "./cycle-rules";

const initial: FormState = {};

const LABELS = {
  name: "Cycle name",
  items: "Assignments in this cycle",
  units: "Units in this cycle",
  periodFrom: "Only results decided from",
  periodTo: "to the end of",
  startsAt: "Start date and time",
  reason: "Reason",
};

export interface UnitOption {
  id: string;
  code: string | null;
  title: string | null;
  /** Assignments in the unit, and how many results wait across them. */
  items: number;
  waiting: number;
  /** The open cycle already covering the unit's assignments, when there is one. */
  openCycleName: string | null;
}

/**
 * C-06 (P0-15; FR-501, P-02): plan a cycle. Scope by assignment or by whole unit, an optional period, and a start:
 * when the coordinator chooses, or automatically at a date and time. A scope overlap comes back as a conflict panel
 * naming the item and the cycle, with one action that takes the item out of the scope.
 */
export function PlanCycleForm({
  cohortId,
  items,
  units,
  samplingRule,
}: {
  cohortId: string;
  items: PoolRow[];
  units: UnitOption[];
  samplingRule: string;
}) {
  const [state, action] = useActionState(planCycle.bind(null, cohortId), initial);
  const values = state.values ?? {};
  const [scopeBy, setScopeBy] = useState<"items" | "units">(values.scopeBy === "units" ? "units" : "items");
  const [start, setStart] = useState<"manual" | "scheduled">(values.start === "scheduled" ? "scheduled" : "manual");
  const [omitted, setOmitted] = useState<string[]>([]);
  const chosenItems = (values.items ?? "").split(",").filter(Boolean);
  const chosenUnits = (values.units ?? "").split(",").filter(Boolean);
  const conflict = values.conflictCycleName
    ? {
        itemId: values.conflictItemId,
        itemTitle: values.conflictItemTitle,
        cycleName: values.conflictCycleName,
        cycleState: (values.conflictCycleState as CycleState) ?? "planned",
      }
    : null;
  const conflictShown = conflict && !omitted.includes(conflict.itemId);

  return (
    <form action={action} className="stack stack--lg" noValidate>
      {state.message && !conflict ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={LABELS} />
      {conflictShown ? (
        <ConflictPanel
          actions={
            <Button onClick={() => setOmitted((current) => [...current, conflict.itemId])} type="button">
              Take {conflict.itemTitle} out of the scope
            </Button>
          }
          evidence={[
            { term: "Item in both scopes", detail: conflict.itemTitle },
            {
              term: "Cycle that already covers it",
              detail: `"${conflict.cycleName}", ${CYCLE_STATE_LABELS[conflict.cycleState]?.toLowerCase() ?? conflict.cycleState}`,
            },
            {
              term: "What to do",
              detail: `Take ${conflict.itemTitle} out of this scope. Its waiting results stay held; plan a cycle for them after "${conflict.cycleName}" is signed off.`,
            },
          ]}
          rule="ADR-019 · cycle_scope_overlap"
          title={`The cycle was not planned: ${conflict.itemTitle} is already in a cycle that is not finished`}
        >
          An assignment can be in only one open cycle at a time, so that no result can be sampled or released twice.
          Nothing was changed.
        </ConflictPanel>
      ) : null}

      <TextField
        defaultValue={values.name}
        error={state.errors?.name}
        help="Moderators and assessors see this name."
        label={LABELS.name}
        name="name"
      />

      <Fieldset legend="Choose the scope by">
        <div onChange={(event) => setScopeBy((event.target as HTMLInputElement).value as "items" | "units")}>
          <Radio defaultChecked={scopeBy === "items"} label="Assignments" name="scopeBy" value="items" />
          <Radio
            defaultChecked={scopeBy === "units"}
            help="Every assignment in the unit, including ones added later."
            label="Whole units"
            name="scopeBy"
            value="units"
          />
        </div>
      </Fieldset>

      {scopeBy === "items" ? (
        <Fieldset error={state.errors?.items} legend={LABELS.items} key={`items-${omitted.length}`}>
          <p className="text-small text-muted">
            When the cycle freezes it locks every waiting result for these assignments. An assignment can be in one open
            cycle at a time.
          </p>
          {items.length === 0 ? (
            <p className="text-muted">No assignment in this cohort has been handed in yet.</p>
          ) : (
            items.map((item) => {
              const covered = item.open_cycle_name !== null;
              const unit = item.unit_code ? `Unit ${item.unit_code}` : "No unit";
              return (
                <Checkbox
                  defaultChecked={chosenItems.includes(item.item_id) && !omitted.includes(item.item_id)}
                  disabled={covered}
                  help={
                    covered
                      ? `Already in "${item.open_cycle_name}", which is ${CYCLE_STATE_LABELS[item.open_cycle_state as CycleState]?.toLowerCase() ?? "open"}.`
                      : `${unit} · ${item.waiting} waiting now${item.released > 0 ? ` · ${item.released} released` : ""}`
                  }
                  key={item.item_id}
                  label={item.title}
                  name="items"
                  value={item.item_id}
                />
              );
            })
          )}
        </Fieldset>
      ) : (
        <Fieldset error={state.errors?.units} legend={LABELS.units}>
          <p className="text-small text-muted">
            Every assignment in the unit joins the cycle, including any published after it is planned.
          </p>
          {units.length === 0 ? (
            <p className="text-muted">No assignment in this cohort belongs to a unit yet.</p>
          ) : (
            units.map((unit) => {
              const covered = unit.openCycleName !== null;
              return (
                <Checkbox
                  defaultChecked={chosenUnits.includes(unit.id)}
                  disabled={covered}
                  help={
                    covered
                      ? `An assignment in this unit is already in "${unit.openCycleName}".`
                      : `${unit.items} ${unit.items === 1 ? "assignment" : "assignments"} · ${unit.waiting} waiting now`
                  }
                  key={unit.id}
                  label={`Unit ${unit.code ?? ""}${unit.title ? `: ${unit.title}` : ""}`}
                  name="units"
                  value={unit.id}
                />
              );
            })
          )}
        </Fieldset>
      )}

      <div className="form__row form__row--2">
        <TextField
          defaultValue={values.periodFrom}
          error={state.errors?.periodFrom}
          label={LABELS.periodFrom}
          name="periodFrom"
          optional
          type="date"
        />
        <TextField
          defaultValue={values.periodTo}
          error={state.errors?.periodTo}
          label={LABELS.periodTo}
          name="periodTo"
          optional
          type="date"
        />
      </div>

      <div onChange={(event) => setStart((event.target as HTMLInputElement).value as "manual" | "scheduled")}>
        <ChoiceGroup columns={2} legend="When should the cycle freeze and draw its sample?">
          <Choice
            defaultChecked={start === "manual"}
            description="Results keep waiting until you choose Freeze and sample."
            name="start"
            title="When I choose"
            value="manual"
          />
          <Choice
            defaultChecked={start === "scheduled"}
            description="The LMS freezes and samples at that time, whether or not anyone is signed in."
            name="start"
            title="Automatically on a date"
            value="scheduled"
          />
        </ChoiceGroup>
      </div>
      {start === "scheduled" ? (
        <TextField
          defaultValue={values.startsAt}
          error={state.errors?.startsAt}
          help="South African time."
          label={LABELS.startsAt}
          name="startsAt"
          type="datetime-local"
        />
      ) : null}

      <div className="field">
        <p className="field__label">Sampling rule in force</p>
        <p className="text-small text-muted">
          Set by the administrator under Configuration. The cycle keeps the version in force when it freezes.
        </p>
        <p className="text-small">{samplingRule}</p>
      </div>

      <div className="form__actions">
        <SubmitButton pendingLabel="Planning">Plan cycle</SubmitButton>
      </div>
    </form>
  );
}

/**
 * Freeze and sample (FR-506): irreversible, so it confirms with the consequence in numbers. The form itself has no
 * fields; the dialog's confirm button submits it.
 */
export function FreezeCycleForm({
  cohortId,
  cycleId,
  version,
  name,
  waiting,
}: {
  cohortId: string;
  cycleId: string;
  version: number;
  name: string;
  /** Results waiting in the cycle's scope now: what the freeze locks. */
  waiting: number;
}) {
  const [state, action] = useActionState(freezeCycle.bind(null, cohortId, cycleId, version), initial);
  const formId = `freeze-${cycleId}`;
  return (
    <form action={action} className="stack" id={formId} noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ConsequenceDialog
        cancelLabel="Not yet"
        confirmLabel="Freeze and sample"
        consequence={
          waiting === 0
            ? "Nothing is waiting in this cycle's scope right now, so there is nothing to lock."
            : `This locks the ${waiting === 1 ? "1 result that is" : `${waiting} results that are`} waiting now and draws the sample. It cannot be undone or redrawn.`
        }
        form={formId}
        title={`Freeze "${name}" and draw its sample?`}
        trigger={{ label: "Freeze and sample now" }}
      >
        <ul className="modal__list">
          <li>Decisions finalised after this moment wait for the next cycle.</li>
          <li>
            Every Not yet competent decision and every first-time assessor&rsquo;s decisions are sampled; the rest at
            the configured percentage, by assessor, outcome and unit.
          </li>
          <li>Sampled items go to the cohort&rsquo;s moderators, never to one who assessed the result.</li>
        </ul>
      </ConsequenceDialog>
    </form>
  );
}

/** Cancelling a planned cycle says why. The results it would have claimed stay waiting. */
export function CancelCycleForm({
  cohortId,
  cycleId,
  version,
  name,
}: {
  cohortId: string;
  cycleId: string;
  version: number;
  name: string;
}) {
  const [state, action] = useActionState(cancelCycle.bind(null, cohortId, cycleId, version), initial);
  return (
    <details className="disclosure">
      <summary>Cancel &ldquo;{name}&rdquo;</summary>
      <form action={action} className="stack" noValidate>
        {state.message ? <Banner title={state.message} tone="critical" /> : null}
        <p className="text-small text-muted">
          You can cancel a cycle only while it is planned. The results stay waiting for another cycle.
        </p>
        <TextareaField
          error={state.errors?.reason}
          help="Kept with the cycle and shown in its history."
          label={LABELS.reason}
          name="reason"
          rows={2}
        />
        <div className="cluster">
          <Button type="submit" variant="destructive-quiet">
            Cancel this cycle
          </Button>
          <TextLink href="#cycles-h">Keep it</TextLink>
        </div>
      </form>
    </details>
  );
}
