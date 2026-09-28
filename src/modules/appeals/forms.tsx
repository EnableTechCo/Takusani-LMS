"use client";

import { useActionState, useState } from "react";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { Field, fieldId } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Icon } from "@/components/ui/icons";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { Banner } from "@/components/ui/status";
import { lodgeAppeal, type LodgeState } from "./actions";
import { GROUNDS_MAX, GROUNDS_MIN, groundsCount, type AppealType } from "./rules";

const initial: LodgeState = {};

const LABELS = { type: "What you are asking for", grounds: "Your reasons" };

export interface LodgeFacts {
  resultId: string;
  itemTitle: string;
  /** "Not yet competent, 5 of 8". */
  resultText: string;
  versionNumber: number | null;
  learnerName: string;
  /** "your coordinator, Ayesha Patel". */
  coordinators: string;
  /** "the end of Tuesday 6 October 2026", when a resubmission date applies. */
  resubmitUntil: string | null;
  /** Why a re-mark cannot be asked for, when it cannot, with the appeal that decides it. */
  remarkBlocked: { reason: string; appealId: string; reference: string; open: boolean } | null;
  /** An open request to see the marked work, which blocks a second one. */
  scriptBlocked: { appealId: string; reference: string } | null;
}

/**
 * L-16 (P0-08): the kind, the reasons, and for a re-mark a confirmation that the mark can go down. The only client
 * state is the kind, the character count and the retry identifier; the database decides everything else.
 */
export function LodgeAppealForm({ facts }: { facts: LodgeFacts }) {
  const [state, action] = useActionState(lodgeAppeal.bind(null, facts.resultId), initial);
  const values = state.values ?? {};
  const remarkOpen = facts.remarkBlocked === null;
  const scriptOpen = facts.scriptBlocked === null;
  const [type, setType] = useState<AppealType | "">(
    (values.type as AppealType | undefined) ?? (remarkOpen ? "" : scriptOpen ? "view_script" : ""),
  );
  const [grounds, setGrounds] = useState(values.grounds ?? "");
  // One identifier for every retry of this appeal, so a lost reply never lodges it twice (P0-08, "network retry").
  const [attempt] = useState(() => crypto.randomUUID());

  const groundsLabel =
    type === "view_script"
      ? "Why do you want to see your work with the marks?"
      : "Why do you think the mark does not match the work you submitted?";

  return (
    <form action={action} aria-label="Lodge an appeal" className="form" id="appeal-form" noValidate>
      <input name="clientAppealId" type="hidden" value={attempt} />
      <ErrorSummary errors={state.errors} labels={LABELS} />
      {state.message ? (
        <Banner title={state.message} tone="critical">
          {state.existing ? (
            <p>
              <TextLink href={`/learn/appeals/${state.existing.id}`}>See appeal {state.existing.reference}</TextLink>
            </p>
          ) : null}
        </Banner>
      ) : null}

      {facts.remarkBlocked ? (
        <Banner
          actions={
            <TextLink href={`/learn/appeals/${facts.remarkBlocked.appealId}`}>
              See appeal {facts.remarkBlocked.reference}
            </TextLink>
          }
          icon="scales"
          role="status"
          title={
            facts.remarkBlocked.open
              ? "You have already asked for a re-mark of this result"
              : "A re-mark has already been done for this result"
          }
          tone="info"
        >
          <p>
            {facts.remarkBlocked.reason} Only one re-mark is allowed for each result.
            {scriptOpen ? " You can still ask to see your work with the marks." : ""}
          </p>
        </Banner>
      ) : null}

      <div id={fieldId("type")}>
        <ChoiceGroup columns={2} legend="What are you asking for?">
          <Choice
            checked={type === "view_script"}
            description={
              scriptOpen
                ? "See your work next to the marks for each criterion and the assessor's feedback. This does not change your mark, and it does not give you more time to ask for a re-mark."
                : `Not available. You already asked to see your work (${facts.scriptBlocked?.reference}), and that request is still open.`
            }
            disabled={!scriptOpen}
            name="type"
            onChange={() => setType("view_script")}
            title="See my work with the marks"
            value="view_script"
          />
          <Choice
            checked={type === "remark"}
            description={
              remarkOpen
                ? "Someone who did not mark your work will mark it again. You can ask for a re-mark once per result."
                : `Not available. ${facts.remarkBlocked?.reason} Only one re-mark is allowed.`
            }
            disabled={!remarkOpen}
            name="type"
            onChange={() => setType("remark")}
            title="Ask for my work to be marked again"
            tone="caution"
            value="remark"
          />
        </ChoiceGroup>
        {state.errors?.type ? (
          <p className="field__error">
            <Icon className="icon icon--sm" name="alert-circle" />
            {state.errors.type}
          </p>
        ) : null}
      </div>

      {remarkOpen ? (
        <Banner icon="scales" role="note" title="A re-mark can move your mark up or down" tone="caution">
          <ul className="prose">
            <li>
              <strong>Your mark can go up, stay the same, or go down.</strong> Your outcome can change with it.
            </li>
            <li>You can ask for a re-mark once for each result.</li>
            <li>The reviewer&apos;s decision is final. There is no further appeal.</li>
          </ul>
        </Banner>
      ) : null}

      <Field
        count={groundsCount(grounds)}
        error={state.errors?.grounds}
        help={
          type === "view_script" ? (
            <>Say which marks or comments you want to understand better. Write at least {GROUNDS_MIN} characters.</>
          ) : (
            <>
              Point to the criteria and to the pages of your work. Write at least {GROUNDS_MIN} characters. For example:
              &ldquo;Criterion 3.2: my access register is on pages 6 and 7, but the feedback says it is missing.&rdquo;
            </>
          )
        }
        label={groundsLabel}
        name="grounds"
      >
        {(control) => (
          <textarea
            {...control}
            className="textarea"
            maxLength={GROUNDS_MAX}
            onChange={(event) => setGrounds(event.target.value)}
            rows={6}
            value={grounds}
          />
        )}
      </Field>

      <p className="text-small text-muted">
        Your appeal is checked first by {facts.coordinators}. The person who marked your work does not review your
        appeal.
      </p>

      <div className="form__actions">
        {type === "remark" ? (
          <ConsequenceDialog
            acknowledgement="I understand my mark can go down as well as up."
            cancelLabel="Go back"
            confirmLabel="Lodge appeal"
            consequence="Your mark can go down as well as up. You can ask for a re-mark only once for this result, and the reviewer's decision is final."
            form="appeal-form"
            title={`Ask for a re-mark of ${facts.itemTitle}?`}
            trigger={{ label: "Lodge appeal" }}
          >
            <ul className="modal__list">
              <li>Your result now: {facts.resultText}.</li>
              <li>
                A reviewer who did not mark your work will mark
                {facts.versionNumber ? ` version ${facts.versionNumber}` : " it"} again.
              </li>
              {facts.resubmitUntil ? <li>Your resubmission date, {facts.resubmitUntil}, stays the same.</li> : null}
              <li>You are lodging this appeal as the learner: {facts.learnerName}.</li>
            </ul>
          </ConsequenceDialog>
        ) : (
          <SubmitButton pendingLabel="Lodging your appeal">Lodge appeal</SubmitButton>
        )}
        <ButtonLink href={`/learn/results/${facts.resultId}`} variant="ghost">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
