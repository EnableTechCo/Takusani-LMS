"use client";

import { useActionState } from "react";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/field";
import { ErrorSummary } from "@/components/ui/form-feedback";
import { BlockedReason } from "@/components/ui/link";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { signOffCycle } from "./sign-off-actions";
import { blockerStateLabel, type Blocker } from "./sign-off-rules";

/**
 * M-04 (P0-13; FR-510, FR-511): the sign-off statement and the one irreversible button, behind a confirmation that
 * states the consequence in a sentence. While the cycle is blocked the button is disabled and the reason is said
 * in text beside it. A refusal after a race lists the blocking items the server named.
 */
export function SignOffForm({
  cycleId,
  version,
  name,
  released,
  consequence,
  blockedBy,
}: {
  cycleId: string;
  version: number;
  name: string;
  /** How many results the sign-off releases. */
  released: number;
  consequence: string;
  /** Why it cannot be signed off now; empty when it can. */
  blockedBy: string[];
}) {
  const [state, action] = useActionState(signOffCycle.bind(null, cycleId, version), {} as FormState);
  const formId = `sign-off-${cycleId}`;
  const raced = state.values?.blockers ? (JSON.parse(state.values.blockers) as Blocker[]) : [];
  const blocked = blockedBy.length > 0;

  return (
    <form action={action} className="stack" id={formId} noValidate>
      {state.message ? (
        <Banner title={state.message} tone="critical">
          {raced.length > 0 ? (
            <ul>
              {raced.map((blocker) => (
                <li key={blocker.item_id}>
                  Item {blocker.seq}, {blocker.learner_name}: {blockerStateLabel(blocker)}
                </li>
              ))}
            </ul>
          ) : null}
        </Banner>
      ) : null}
      <ErrorSummary errors={state.errors} labels={{ statement: "Sign-off statement" }} />
      <TextareaField
        defaultValue={state.values?.statement}
        error={state.errors?.statement}
        help="What you confirm by signing off, in your own words: for example that every sampled decision was reviewed and that marking is consistent. It is kept with the release, with your name and the time."
        label="Sign-off statement"
        markRequired
        name="statement"
        rows={3}
      />
      {blocked ? (
        <div className="stack stack--sm">
          <BlockedReason id="sign-off-blocked">
            Sign-off is not possible yet. {blockedBy.join(" ")} Nothing is released, and no learner is told anything,
            until every item is concluded.
          </BlockedReason>
          <div>
            <button aria-describedby="sign-off-blocked" className="btn btn--primary" disabled type="button">
              Sign off and release
            </button>
          </div>
        </div>
      ) : (
        <ConsequenceDialog
          cancelLabel="Not yet"
          confirmLabel="Sign off and release"
          consequence={consequence}
          form={formId}
          title={`Sign off "${name}" and release ${released === 1 ? "1 result" : `${released} results`}?`}
          trigger={{ label: "Sign off and release" }}
        >
          <ul className="modal__list">
            <li>Sampled or not, every result in the frozen population is released together.</li>
            <li>Each Not yet competent result&rsquo;s resubmission period runs from now.</li>
            <li>Decisions finalised after the freeze are not released; they wait for the next cycle.</li>
          </ul>
        </ConsequenceDialog>
      )}
    </form>
  );
}
