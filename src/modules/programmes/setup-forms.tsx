"use client";

import { useActionState, useState } from "react";
import { ChoiceGroup, Choice } from "@/components/ui/choice";
import { ConflictPanel } from "@/components/ui/conflict";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { TextLink } from "@/components/ui/link";
import { Banner } from "@/components/ui/status";
import { formatLongDayOf } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { advisoryTotal, resultsText } from "@/modules/identity/roles-rules";
import {
  activateCohort,
  assignCohortRole,
  assignReadinessItem,
  setModerationPolicy,
  type CohortRoleState,
  type PolicyState,
} from "./setup-actions";
import { unreleasedText } from "./setup-rules";

/**
 * C-03 moderation policy (P-01, BR-04). There is no default. Once chosen, a change needs a reason, and a change to Not
 * moderated is refused while results are waiting or held; the refusal says how many and what to do.
 */
export function PolicyForm({
  cohortId,
  cohortName,
  policy,
  version,
}: {
  cohortId: string;
  cohortName: string;
  policy: string | null;
  version: number;
}) {
  const [state, action] = useActionState(setModerationPolicy.bind(null, cohortId, version), {} as PolicyState);
  const [chosen, setChosen] = useState(state.values?.policy ?? policy ?? "");
  const changing = policy !== null && chosen !== "" && chosen !== policy;

  return (
    <form action={action} className="stack" noValidate>
      {state.blocked ? (
        <ConflictPanel
          evidence={[
            {
              term: "Waiting for a cycle",
              detail: `${state.blocked.waiting} ${state.blocked.waiting === 1 ? "result" : "results"}`,
            },
            {
              term: "Held in a cycle",
              detail: `${state.blocked.held} ${state.blocked.held === 1 ? "result" : "results"}`,
            },
            {
              term: "What to do",
              detail:
                "Plan and sign off moderation cycles for them. When nothing is waiting or held, you can change the policy here.",
            },
          ]}
          rule="BR-04 · results_pending_or_held"
          title="The policy was not changed: results are waiting or held"
        >
          <p>
            You cannot change {cohortName} to Not moderated: {unreleasedText(state.blocked.waiting, state.blocked.held)}
            . Changing the policy now would release them to learners without moderation. Nothing was changed.
          </p>
          <p>
            <TextLink href={`/coordinate/cohorts/${cohortId}/moderation`}>Open moderation planning</TextLink>
          </p>
        </ConflictPanel>
      ) : state.message ? (
        <Banner title={state.message} tone="critical" />
      ) : null}
      <ErrorSummary errors={state.errors} labels={{ policy: "Moderation policy", reason: "Reason for the change" }} />
      <ChoiceGroup
        legend={
          policy ? "How are results in this cohort released?" : "How are results in this cohort released? (required)"
        }
      >
        <div onChange={(event) => setChosen((event.target as HTMLInputElement).value)}>
          <Choice
            defaultChecked={(state.values?.policy ?? policy) === "moderated"}
            description="Every result is held until a moderation cycle signs it off. Learners see nothing, not even Not yet competent, until then. You must plan cycles and keep a moderator assigned."
            name="policy"
            title="Moderated"
            value="moderated"
          />
          <Choice
            defaultChecked={(state.values?.policy ?? policy) === "not_moderated"}
            description="Each result is released to the learner as soon as the assessor decides. Their time to appeal starts at that moment. No second person checks the result first."
            name="policy"
            title="Not moderated"
            value="not_moderated"
          />
        </div>
      </ChoiceGroup>
      {policy === null ? (
        <p className="text-small text-muted">There is no default. Choose one before you activate the cohort.</p>
      ) : (
        <p className="text-small text-muted">
          You can change to Not moderated only while no results are waiting or held. Every change is versioned and
          audited.
        </p>
      )}
      {changing ? (
        <TextareaField
          defaultValue={state.values?.reason}
          error={state.errors?.reason}
          help="Kept in the policy history, with your name."
          label="Reason for the change"
          name="reason"
          rows={2}
        />
      ) : null}
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">{policy === null ? "Confirm policy" : "Change policy"}</SubmitButton>
      </div>
    </form>
  );
}

/** C-03 review and activate: shown only when every gating item is done. */
export function ActivateForm({
  cohortId,
  cohortName,
  learners,
}: {
  cohortId: string;
  cohortName: string;
  learners: number;
}) {
  return (
    <form action={activateCohort.bind(null, cohortId)} id="activate-form">
      <ConsequenceDialog
        cancelLabel="Not yet"
        confirmLabel="Activate cohort"
        consequence={`${cohortName} becomes visible to its ${learners === 1 ? "learner" : `${learners} learners`} at once: their tasks, material and sessions appear.`}
        form="activate-form"
        title={`Activate ${cohortName}?`}
        trigger={{ label: "Activate cohort" }}
      >
        <ul className="modal__list">
          <li>A cohort cannot go back into setup.</li>
          <li>The moderation policy can still change later, under the same rules.</li>
        </ul>
      </ConsequenceDialog>
    </form>
  );
}

/** C-05 assign an open item to someone on the cohort's staff, with a due date and a note (FR-702). */
export function AssignItemForm({
  cohortId,
  itemKey,
  itemLabel,
  staff,
  assigneeId,
  dueOn,
  note,
}: {
  cohortId: string;
  itemKey: string;
  itemLabel: string;
  staff: { value: string; label: string }[];
  assigneeId: string | null;
  dueOn: string | null;
  note: string | null;
}) {
  const [state, action] = useActionState(assignReadinessItem.bind(null, cohortId, itemKey), {} as FormState);
  const values = state.values ?? { assignee: assigneeId ?? "", dueOn: dueOn ?? "", note: note ?? "" };
  return (
    <form action={action} aria-label={`Assign: ${itemLabel}`} className="stack" noValidate>
      {state.done ? (
        <Banner compact role="status" title="Assigned. They have been told in the LMS." tone="positive" />
      ) : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <div className="form__row form__row--2">
        <SelectField
          defaultValue={values.assignee}
          error={state.errors?.assignee}
          label="Assign to"
          name="assignee"
          options={staff}
          placeholder="Choose someone"
        />
        <TextField
          defaultValue={values.dueOn}
          error={state.errors?.dueOn}
          label="Due"
          name="dueOn"
          optional
          type="date"
        />
      </div>
      <TextField defaultValue={values.note} error={state.errors?.note} label="Note" name="note" optional />
      <div className="cluster">
        <SubmitButton pendingLabel="Assigning">{assigneeId ? "Reassign" : "Assign"}</SubmitButton>
      </div>
    </form>
  );
}

/** C-04 give someone a facilitator, assessor or moderator role in this cohort, by email (FR-701, FR-104, U-01). */
export function CohortRoleForm({ cohortId }: { cohortId: string }) {
  const [state, action] = useActionState(assignCohortRole.bind(null, cohortId), {} as CohortRoleState);
  const values = state.values ?? {};
  const advisories = state.advisories ?? [];
  return (
    <div className="stack">
      {state.done ? (
        <Banner
          compact
          role="status"
          title={`${state.personName} is now a ${state.assigned?.toLowerCase()} in this cohort`}
          tone="positive"
        >
          <p>They have been told. The change is in their account&apos;s history.</p>
        </Banner>
      ) : null}
      {state.done && advisories.length > 0 ? (
        <ConflictPanel
          advisory
          evidence={advisories.map((advisory) => ({
            term: `${advisory.item_title} (${advisory.cohort_name})`,
            detail: `${resultsText(advisory.results)} they assessed, from ${formatLongDayOf(advisory.first_decided_at)}. They cannot moderate them, or review an appeal against them.`,
          }))}
          rule={`BR-01, BR-02 · advisory separation_of_duties_exclusions · ${resultsText(advisoryTotal(advisories))}`}
          title="For your information: work they will be kept away from"
        >
          <p>Nothing was refused. That work is checked, item by item, when work is allocated.</p>
        </ConflictPanel>
      ) : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <form action={action} className="stack" noValidate>
        <ErrorSummary
          errors={state.errors}
          labels={{ email: "Email address", role: "Role", until: "Until the end of" }}
        />
        <div className="form__row form__row--2">
          <TextField
            autoComplete="off"
            defaultValue={values.email}
            error={state.errors?.email}
            help="Their account must already exist."
            label="Email address"
            name="email"
            type="email"
          />
          <SelectField
            defaultValue={values.role}
            error={state.errors?.role}
            label="Role"
            name="role"
            options={[
              { value: "facilitator", label: "Facilitator" },
              { value: "assessor", label: "Assessor" },
              { value: "moderator", label: "Moderator" },
            ]}
            placeholder="Choose a role"
          />
        </div>
        <TextField
          defaultValue={values.until}
          error={state.errors?.until}
          help="Leave empty for no end date."
          label="Until the end of"
          name="until"
          optional
          type="date"
        />
        <div className="cluster">
          <SubmitButton pendingLabel="Assigning">Assign role</SubmitButton>
        </div>
      </form>
    </div>
  );
}
