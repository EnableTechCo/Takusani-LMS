"use client";

import { useActionState } from "react";
import { ConflictPanel } from "@/components/ui/conflict";
import { SelectField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import { formatLongDayOf } from "@/lib/dates";
import { assignRole, type AssignState } from "./roles-actions";
import { advisoryTotal, resultsText, roleLabel } from "./roles-rules";

const ROLE_OPTIONS = ["facilitator", "assessor", "moderator", "coordinator", "administrator"].map((role) => ({
  value: role,
  label: roleLabel(role),
}));

const LABELS = { role: "Role", scope: "Where it applies", until: "Until the end of" };

/**
 * X-04 Add a role (FR-104, U-01). The role applies from now. When the person has assessed work in its scope, the
 * role is still assigned, and the advisory names the results they will be kept away from; the allocation commands
 * refuse those results by name.
 */
export function AddRoleForm({
  profileId,
  personName,
  scopes,
}: {
  profileId: string;
  personName: string;
  scopes: { value: string; label: string }[];
}) {
  const [state, action] = useActionState(assignRole.bind(null, profileId), {} as AssignState);
  const values = state.values ?? {};
  const scopeLabel = scopes.find((scope) => scope.value === values.scope)?.label.replace(/^(Programme|Cohort): /, "");
  const advisories = state.advisories ?? [];

  return (
    <div className="stack">
      {state.done ? (
        <Banner compact role="status" title={`Role assigned: ${state.assigned}, ${scopeLabel ?? ""}`} tone="positive">
          <p>In force from now. {personName} has been told. The change is in the history, with the previous value.</p>
        </Banner>
      ) : null}
      {state.done && advisories.length > 0 ? (
        <ConflictPanel
          advisory
          evidence={advisories.map((advisory) => ({
            term: `${advisory.item_title} (${advisory.cohort_name})`,
            detail: `${resultsText(advisory.results)} they assessed, ${formatLongDayOf(advisory.first_decided_at)}${
              advisory.first_decided_at.slice(0, 10) === advisory.last_decided_at.slice(0, 10)
                ? ""
                : ` to ${formatLongDayOf(advisory.last_decided_at)}`
            }. They cannot moderate any of them, or review an appeal against them.`,
          }))}
          rule={`BR-01, BR-02 · advisory separation_of_duties_exclusions · ${resultsText(advisoryTotal(advisories))}`}
          title="For your information: work they will be kept away from"
        >
          <p>
            Nothing was refused. {personName} has assessed work in this scope, so as a moderator or appeal reviewer they
            will never be given these results. The LMS checks this for each item when work is allocated, and refuses by
            name if anyone tries.
          </p>
        </ConflictPanel>
      ) : null}

      <form action={action} className="form" noValidate>
        {state.message ? <Banner title={state.message} tone="critical" /> : null}
        <ErrorSummary errors={state.errors} labels={LABELS} />
        <div className="form__row form__row--2">
          <SelectField
            defaultValue={state.done ? undefined : values.role}
            error={state.errors?.role}
            label={LABELS.role}
            name="role"
            options={ROLE_OPTIONS}
            placeholder="Choose a role"
          />
          <SelectField
            defaultValue={state.done ? undefined : values.scope}
            error={state.errors?.scope}
            help="A role says what the person may be given, not any particular piece of work."
            label={LABELS.scope}
            name="scope"
            options={scopes}
            placeholder="Choose where it applies"
          />
        </div>
        <TextField
          defaultValue={state.done ? undefined : values.until}
          error={state.errors?.until}
          help="Leave empty for no end date. The role applies from now."
          label={LABELS.until}
          name="until"
          optional
          type="date"
        />
        <div className="form__actions">
          <SubmitButton pendingLabel="Assigning the role">Assign role</SubmitButton>
        </div>
      </form>
    </div>
  );
}
