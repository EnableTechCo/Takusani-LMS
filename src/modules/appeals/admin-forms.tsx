"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { ConflictPanel } from "@/components/ui/conflict";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { Field, fieldId } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Icon } from "@/components/ui/icons";
import { BlockedReason } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatLongDayOf } from "@/lib/dates";
import type { FormState } from "@/lib/form-state";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { renderNotification } from "@/modules/notifications/templates";
import { allocateReviewer, decideAdmissibility, type AllocateState } from "./actions";
import { TIER_LABELS, type ExcludingDecision } from "./rules";

/** "Not yet competent on Monday 28 September 2026 (version 1)". */
function decisionText(decision: { outcome: string; decided_at: string; version_number: number | null }): string {
  const version = decision.version_number ? ` (version ${decision.version_number})` : "";
  return `${OUTCOME_LABELS[decision.outcome] ?? decision.outcome} on ${formatLongDayOf(decision.decided_at)}${version}`;
}

/**
 * C-12 admissibility (FR-605): admit, or record as inadmissible with the reason the learner reads word for word. The
 * learner's notification is previewed from the same template that sends it. Either way the decision is final.
 */
export function AdmissibilityForm({
  appealId,
  type,
  reference,
  itemTitle,
  learnerName,
  turnaroundWorkingDays,
}: {
  appealId: string;
  type: "view_script" | "remark";
  reference: string;
  itemTitle: string;
  learnerName: string;
  turnaroundWorkingDays: number;
}) {
  const [state, action] = useActionState(decideAdmissibility.bind(null, appealId), {} as FormState);
  const values = state.values ?? {};
  const [decision, setDecision] = useState(values.decision ?? "");
  const [reason, setReason] = useState(values.reason ?? "");
  const admitTitle = type === "remark" ? "Admit" : "Grant the view of the marked work";

  const preview =
    decision === "admit" || (decision === "inadmissible" && reason.trim())
      ? renderNotification(decision === "admit" ? "appeal_admitted" : "appeal_inadmissible", 1, {
          reference,
          item_title: itemTitle,
          type,
          reason: reason.trim(),
          turnaround_working_days: turnaroundWorkingDays,
        })
      : null;

  return (
    <form action={action} className="form" id="admissibility-form" noValidate>
      <ErrorSummary errors={state.errors} labels={{ decision: "Decision", reason: "Reason" }} />
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <div id={fieldId("decision")}>
        <ChoiceGroup columns={2} legend="Can this appeal be accepted?">
          <Choice
            checked={decision === "admit"}
            description={
              type === "remark"
                ? `${learnerName} is told today that the appeal was accepted. You then choose a reviewer who took no assessment decision on this work.`
                : `${learnerName} is told today and can see the work next to the marks for each criterion and the assessor's feedback.`
            }
            name="decision"
            onChange={() => setDecision("admit")}
            title={admitTitle}
            value="admit"
          />
          <Choice
            checked={decision === "inadmissible"}
            description={`The appeal ends here. ${learnerName} is told, with your reason. This cannot be reversed.`}
            name="decision"
            onChange={() => setDecision("inadmissible")}
            title="Record as inadmissible"
            tone="caution"
            value="inadmissible"
          />
        </ChoiceGroup>
        {state.errors?.decision ? (
          <p className="field__error">
            <Icon className="icon icon--sm" name="alert-circle" />
            {state.errors.decision}
          </p>
        ) : null}
      </div>

      {decision === "inadmissible" ? (
        <Field
          count={`${reason.trim().length} / 1000 characters`}
          error={state.errors?.reason}
          help={`${learnerName} reads this word for word. Say which rule the appeal does not meet. Do not comment on the work.`}
          label="Why it cannot be accepted"
          name="reason"
        >
          {(control) => (
            <textarea
              {...control}
              className="textarea"
              maxLength={1000}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              value={reason}
            />
          )}
        </Field>
      ) : null}

      {preview ? (
        <div>
          <p className="text-subheading u-mb-4">What {learnerName} will be sent</p>
          <div aria-live="polite" className="notice-preview">
            <p>
              <strong>{preview.title}</strong>
            </p>
            {preview.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <p className="text-meta">In the LMS · cannot be switched off</p>
          </div>
        </div>
      ) : null}

      <div className="form__actions">
        {decision ? (
          <ConsequenceDialog
            cancelLabel="Go back"
            confirmLabel={decision === "admit" ? "Accept and tell the learner" : "Record and tell the learner"}
            consequence={
              decision === "admit"
                ? type === "remark"
                  ? `${learnerName} is told the appeal was accepted. It then needs a reviewer who took no assessment decision on this work.`
                  : `${learnerName} is told the request was accepted and can see the marked work.`
                : `The appeal ends here. ${learnerName} is told, with your reason. This cannot be reversed.`
            }
            form="admissibility-form"
            title={decision === "admit" ? `Accept appeal ${reference}?` : `Record appeal ${reference} as inadmissible?`}
            trigger={{ label: "Record decision" }}
          >
            <ul className="modal__list">
              <li>The decision is recorded once and cannot be changed.</li>
              <li>You are deciding as a coordinator of this cohort.</li>
            </ul>
          </ConsequenceDialog>
        ) : (
          <SubmitButton pendingLabel="Recording the decision">Record decision</SubmitButton>
        )}
      </div>
    </form>
  );
}

export interface Candidate {
  profile_id: string;
  full_name: string;
  tier: number | null;
  role_label: string | null;
  open_reviews: number;
  excluded_by: ExcludingDecision[] | null;
  is_current: boolean;
}

function openReviews(count: number): string {
  return count === 1 ? "1 open review" : `${count} open reviews`;
}

/**
 * C-12 reviewer allocation (FR-608, AS-02, P-10): candidates in the three tiers, and everyone who took an assessment
 * decision on the work shown but not choosable, each with the reason. The database checks again when it allocates.
 */
export function ReviewerForm({
  appealId,
  reference,
  learnerName,
  itemTitle,
  candidates,
  reallocating,
}: {
  appealId: string;
  reference: string;
  learnerName: string;
  itemTitle: string;
  candidates: Candidate[];
  reallocating: boolean;
}) {
  const [state, action] = useActionState(allocateReviewer.bind(null, appealId), {} as AllocateState);
  const values = state.values ?? {};
  const [chosen, setChosen] = useState(values.reviewerId ?? "");
  const [skipReason, setSkipReason] = useState(values.skipReason ?? "");
  const formId = reallocating ? "reallocate-form" : "allocate-form";

  const eligible = candidates.filter((candidate) => candidate.tier !== null && !candidate.is_current);
  const excluded = candidates.filter((candidate) => candidate.tier === null);
  const current = candidates.find((candidate) => candidate.is_current) ?? null;
  const cannotCount = excluded.length + (current ? 1 : 0);
  const best = eligible.length ? Math.min(...eligible.map((candidate) => candidate.tier!)) : null;
  const selected = eligible.find((candidate) => candidate.profile_id === chosen) ?? null;
  const skipping = selected !== null && best !== null && selected.tier! > best;

  return (
    <form action={action} className="form" id={formId} noValidate>
      {state.conflict ? (
        <ConflictPanel
          evidence={[
            ...state.conflict.decisions.map((decision) => ({
              term: "Conflicting decision",
              detail: `${decisionText(decision)}, ${learnerName}, ${itemTitle}`,
            })),
            { term: "Their role in that decision", detail: "Assessor" },
            { term: "Allocation refused", detail: `Reviewer of appeal ${reference}` },
          ]}
          rule="BR-02 · separation_of_duties_conflict"
          title="This would break separation of duties"
        >
          <p>
            {state.conflict.reviewerName || "The person you chose"} cannot review this appeal because they took an
            assessment decision on this work. The appeal was not allocated and nothing was changed. The list on your
            screen was out of date; it has been reloaded below.
          </p>
        </ConflictPanel>
      ) : null}
      <ErrorSummary errors={state.errors} labels={{ reviewerId: "Reviewer", skipReason: "Reason" }} />
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      {eligible.length === 0 ? (
        // UX flow F, E2: nobody left in any tier. The list below still shows who is excluded and why.
        <Banner icon="scales" role="status" title="No one can review this appeal yet" tone="caution">
          <p>
            Everyone qualified has assessed this work{reallocating ? ", or is already the reviewer" : ""}. Ask an
            administrator to give a qualified assessor from another cohort the assessor role, then return here.
          </p>
        </Banner>
      ) : null}

      <p className="text-small text-muted u-measure">
        People are listed in the order set by the appeals policy. Choose from the first group that has someone
        available. Anyone who took an assessment decision on this work is shown, but cannot be chosen.
      </p>
      <input name="reviewerName" type="hidden" value={selected?.full_name ?? ""} />
      {/* A11Y-21: people who cannot be chosen are not disabled options (a screen reader moving through the choices
          would never hear of them); the legend says how many there are, and they are listed after the choices with
          the reason. */}
      <fieldset className="candidate-list" id={fieldId("reviewerId")}>
        <legend className="fieldset__legend">
          Reviewer for appeal {reference} ({learnerName}, {itemTitle})
          {cannotCount > 0 ? (
            <span className="u-visually-hidden">
              .{" "}
              {cannotCount === 1
                ? "1 person cannot be chosen; they are"
                : `${cannotCount} people cannot be chosen; they are`}{" "}
              listed after the choices, with the reason.
            </span>
          ) : null}
        </legend>
        {[1, 2, 3].map((tier) => {
          const people = eligible.filter((candidate) => candidate.tier === tier);
          return (
            <div className="candidate-list__tier" key={tier}>
              <h3 className="candidate-list__tier-title">{TIER_LABELS[tier]}</h3>
              {people.length === 0 ? (
                <p className="candidate-list__empty">No one available.</p>
              ) : (
                people.map((candidate) => (
                  <label className="candidate" key={candidate.profile_id}>
                    <input
                      checked={chosen === candidate.profile_id}
                      className="candidate__input"
                      name="reviewerId"
                      onChange={() => setChosen(candidate.profile_id)}
                      type="radio"
                      value={candidate.profile_id}
                    />
                    <span className="candidate__name">{candidate.full_name}</span>
                    {candidate.role_label ? <Tag tone="neutral">{candidate.role_label}</Tag> : null}
                    <span className="candidate__meta">{openReviews(candidate.open_reviews)}</span>
                    {tier === 3 ? (
                      <span className="candidate__note">Will be given access to this appeal only.</span>
                    ) : null}
                  </label>
                ))
              )}
            </div>
          );
        })}
      </fieldset>
      {cannotCount > 0 ? (
        <section aria-labelledby={`${formId}-excluded`} className="candidate-list__tier">
          <h3 className="candidate-list__tier-title" id={`${formId}-excluded`}>
            Cannot be chosen
          </h3>
          <ul className="stack stack--sm">
            {current ? (
              <li className="candidate is-excluded cursor-default grid-cols-[minmax(0,1fr)_auto]">
                <span className="candidate__name">{current.full_name}</span>
                <span className="candidate__reason col-[1/-1]">Already the reviewer of this appeal.</span>
              </li>
            ) : null}
            {excluded.map((candidate) => (
              <li
                className="candidate is-excluded cursor-default grid-cols-[minmax(0,1fr)_auto]"
                key={candidate.profile_id}
              >
                <span className="candidate__name">{candidate.full_name}</span>
                {candidate.role_label ? <Tag tone="neutral">{candidate.role_label}</Tag> : null}
                <span className="candidate__reason col-[1/-1]">
                  Marked this work: {(candidate.excluded_by ?? []).map(decisionText).join("; ")}. Anyone who took an
                  assessment decision on the work cannot review an appeal against it. Rule BR-02.
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {skipping ? (
        <Field
          error={state.errors?.skipReason}
          help={`Someone is available in ${TIER_LABELS[best!].split(":")[0].toLowerCase()}. The reason is kept on the appeal's record.`}
          label={`Why you are choosing ${selected!.full_name}`}
          name="skipReason"
        >
          {(control) => (
            <textarea
              {...control}
              className="textarea"
              onChange={(event) => setSkipReason(event.target.value)}
              rows={2}
              value={skipReason}
            />
          )}
        </Field>
      ) : null}

      <div className="form__actions">
        {selected ? (
          <ConsequenceDialog
            cancelLabel="Go back"
            confirmLabel={`Allocate and notify ${selected.full_name}`}
            consequence={`${selected.full_name} will be notified and will mark ${learnerName}'s ${itemTitle} again. Their decision is final and can move the mark up or down.`}
            form={formId}
            title={`Allocate this re-mark to ${selected.full_name}?`}
            trigger={{ label: reallocating ? "Reallocate reviewer" : "Allocate reviewer" }}
          >
            <ul className="modal__list">
              <li>
                The LMS checks again, at this moment, that they took no assessment decision on this work. If they did,
                the allocation is refused and nothing changes.
              </li>
              <li>You can reallocate later if they become unavailable.</li>
            </ul>
          </ConsequenceDialog>
        ) : (
          <>
            <BlockedReason id={`${formId}-blocked`}>
              {eligible.length === 0 ? "No one can be chosen yet." : "Choose a reviewer first."}
            </BlockedReason>
            <Button aria-describedby={`${formId}-blocked`} disabled variant="primary">
              {reallocating ? "Reallocate reviewer" : "Allocate reviewer"}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
