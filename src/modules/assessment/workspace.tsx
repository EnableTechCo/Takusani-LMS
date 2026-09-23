"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Choice, ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Banner, StatusLine, Tag } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { BlockedReason } from "@/components/ui/link";
import { formatDateTime, formatDay, formatTime, lastFullDayBefore, sastDatePlusDays } from "@/lib/dates";
import { finaliseDecision, saveMarkingDraft, takeMarking } from "./actions";
import { missingForFinalise, OUTCOME_LABELS, runningTotal, type Draft, type Score } from "./rules";

/**
 * The marking workspace (P0-11). Evidence on one side, the rubric, feedback and history on the other, and the
 * decision bar at the foot. The draft saves itself a moment after the assessor stops typing, and says when it last
 * saved; nothing about marking is lost to a closed tab.
 */

export interface Criterion {
  ordinal: number;
  title: string;
  descriptor: string | null;
  points: number | null;
}

export interface VersionFile {
  filename: string;
  bytes: number;
  object_key: string;
  requirement: string | null;
}

export interface Version {
  version_number: number;
  submitted_at: string;
  is_late: boolean;
  receipt_reference: string;
  assessed: boolean;
  files: VersionFile[];
}

export interface StoredDraft {
  scores: Score[];
  feedback: string | null;
  outcome: "competent" | "not_yet_competent" | null;
  justification: string | null;
  remediation: string | null;
  resubmission_days: number | null;
  version: number;
  updated_at: string;
}

const AUTOSAVE_AFTER_MS = 2000;

function initialDraft(criteria: Criterion[], stored: StoredDraft | null): Draft {
  return {
    scores: criteria.map((criterion) => {
      const saved = stored?.scores.find((score) => score.ordinal === criterion.ordinal);
      return { ordinal: criterion.ordinal, points: saved?.points ?? null, comment: saved?.comment ?? "" };
    }),
    feedback: stored?.feedback ?? "",
    outcome: stored?.outcome ?? null,
    justification: stored?.justification ?? "",
    remediation: stored?.remediation ?? "",
    resubmissionDays: stored?.resubmission_days ?? null,
  };
}

export function MarkingWorkspace({
  instanceId,
  canMark,
  canTake,
  takenBySomeoneElse,
  criteria,
  versions,
  links,
  stored,
  decisions,
  moderated,
  learnerName,
  decided,
}: {
  instanceId: string;
  /** This assessor has taken the item and it is open for marking. */
  canMark: boolean;
  /** Nobody has taken the item yet, so it can be taken. */
  canTake: boolean;
  /** The name of whoever else is marking it, when it is not this assessor. */
  takenBySomeoneElse: string | null;
  criteria: Criterion[];
  versions: Version[];
  /** Signed links to open each file, by object key. */
  links: Record<string, string>;
  stored: StoredDraft | null;
  decisions: { type: string; outcome: string; acting_role: string; created_at: string }[];
  moderated: boolean;
  learnerName: string;
  /** Where the result stands once this item is decided; null while it is still being marked. */
  decided: {
    resultState: string;
    releasedAt: string | null;
    appealDeadlineAt: string | null;
    remediationDeadlineAt: string | null;
  } | null;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(criteria, stored));
  const [version, setVersion] = useState(stored?.version ?? 0);
  const [savedAt, setSavedAt] = useState<string | null>(stored?.updated_at ?? null);
  const [dirty, setDirty] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const [taking, startTaking] = useTransition();
  const [finalising, startFinalising] = useTransition();
  const [viewing, setViewing] = useState(versions.find((item) => item.assessed)?.version_number ?? 0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const change = (update: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...update }));
    setDirty(true);
  };
  const changeScore = (ordinal: number, update: Partial<Score>) =>
    change({ scores: draft.scores.map((score) => (score.ordinal === ordinal ? { ...score, ...update } : score)) });

  const save = useCallback(() => {
    if (!canMark) return;
    startSaving(async () => {
      const result = await saveMarkingDraft(instanceId, version, draft);
      if (result.ok) {
        setVersion(result.version);
        setSavedAt(result.savedAt);
        setDirty(false);
        setProblem(null);
      } else {
        setProblem(result.message);
      }
    });
  }, [canMark, draft, instanceId, version]);

  // Save a moment after the assessor stops typing (FR-403): "Draft saved 10:42".
  useEffect(() => {
    if (!dirty || !canMark) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, AUTOSAVE_AFTER_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [dirty, canMark, save]);

  const total = runningTotal(criteria, draft.scores);
  const missing = missingForFinalise(draft);
  const shown = versions.find((item) => item.version_number === viewing) ?? versions[0];
  const assessed = versions.find((item) => item.assessed);

  const rubric = (
    <div className="rubric">
      {criteria.length === 0 ? <p className="text-muted">This task has no rubric rows.</p> : null}
      {criteria.map((criterion) => {
        const score = draft.scores.find((item) => item.ordinal === criterion.ordinal)!;
        return (
          <fieldset
            className={score.points === null && criterion.points !== null ? "rubric__row is-unscored" : "rubric__row"}
            key={criterion.ordinal}
          >
            <legend className="rubric__head">
              <span>
                <span className="rubric__id">{criterion.ordinal}</span>{" "}
                <span className="rubric__title">{criterion.title}</span>
              </span>
              {criterion.points !== null ? (
                <span className="rubric__score">
                  {score.points ?? "–"} / {criterion.points}
                </span>
              ) : null}
            </legend>
            {criterion.descriptor ? <p className="rubric__desc">{criterion.descriptor}</p> : null}
            <div className="stack stack--sm">
              {criterion.points !== null ? (
                <Field
                  help={`Out of ${criterion.points}.`}
                  label={`Mark for ${criterion.title}`}
                  name={`score-${criterion.ordinal}`}
                  optional
                >
                  {(control) => (
                    <input
                      {...control}
                      className="input"
                      disabled={!canMark}
                      inputMode="numeric"
                      max={criterion.points ?? undefined}
                      min={0}
                      name={undefined}
                      onChange={(event) =>
                        changeScore(criterion.ordinal, {
                          points: event.target.value === "" ? null : Number(event.target.value),
                        })
                      }
                      type="number"
                      value={score.points ?? ""}
                    />
                  )}
                </Field>
              ) : null}
              <Field label={`Comment on ${criterion.title}`} name={`comment-${criterion.ordinal}`} optional>
                {(control) => (
                  <textarea
                    {...control}
                    className="textarea"
                    disabled={!canMark}
                    name={undefined}
                    onChange={(event) => changeScore(criterion.ordinal, { comment: event.target.value })}
                    rows={2}
                    value={score.comment}
                  />
                )}
              </Field>
            </div>
          </fieldset>
        );
      })}
      {total ? (
        <p className="rubric__total">
          Total <span className="rubric__total-value">{total.scored}</span> of {total.possible}
        </p>
      ) : null}
    </div>
  );

  const feedback = (
    <Field
      help="Written for the learner. They read it with the outcome when the result is released."
      label="Overall feedback"
      name="feedback"
      optional
    >
      {(control) => (
        <textarea
          {...control}
          className="textarea textarea--feedback"
          disabled={!canMark}
          name={undefined}
          onChange={(event) => change({ feedback: event.target.value })}
          value={draft.feedback}
        />
      )}
    </Field>
  );

  const history = (
    <div className="stack">
      <ol aria-label="Versions, newest first" className="history-list">
        {versions.map((item) => (
          <li
            className={item.assessed ? "history-list__item is-current" : "history-list__item"}
            key={item.version_number}
          >
            <span className="history-list__badge">v{item.version_number}</span>
            <span className="history-list__title">
              Version {item.version_number} {item.is_late ? <Tag tone="caution">Late</Tag> : null}
            </span>
            <span className="history-list__meta">
              {formatDateTime(item.submitted_at)} · receipt <span className="mono">{item.receipt_reference}</span>
            </span>
            <span className="history-list__actions">{item.assessed ? <Tag plain>Being assessed</Tag> : null}</span>
          </li>
        ))}
      </ol>
      {decisions.length ? (
        <ol aria-label="Earlier decisions on this result" className="stack stack--sm">
          {decisions.map((decision, index) => (
            <li key={index}>
              {OUTCOME_LABELS[decision.outcome] ?? decision.outcome}, {decision.type} decision by the{" "}
              {decision.acting_role}, {formatDateTime(decision.created_at)}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-muted">No decision has been recorded on this result yet.</p>
      )}
    </div>
  );

  const finalise = () =>
    startFinalising(async () => {
      let current = version;
      if (dirty) {
        const saved = await saveMarkingDraft(instanceId, version, draft);
        if (!saved.ok) {
          setProblem(saved.message);
          return;
        }
        current = saved.version;
        setVersion(saved.version);
        setDirty(false);
      }
      const result = await finaliseDecision(instanceId, current);
      if (!result.ok) setProblem(result.message);
    });

  const consequence = moderated
    ? `This decision will be held. ${learnerName} will not see it until moderation of this cohort is signed off.`
    : `This releases the result to ${learnerName} now and starts the seven-day appeal window, which closes at the end of ${formatDay(
        sastDatePlusDays(7),
      )}.${
        draft.outcome === "not_yet_competent" && draft.resubmissionDays
          ? ` ${learnerName} must resubmit within ${draft.resubmissionDays} days.`
          : ""
      }`;

  return (
    <>
      {decided ? (
        decided.resultState === "released" && decided.releasedAt && decided.appealDeadlineAt ? (
          <Banner title="Decided and released" tone="positive">
            <p>
              Released {formatDateTime(decided.releasedAt)} (SAST). The appeal window closes at the end of{" "}
              {lastFullDayBefore(decided.appealDeadlineAt)}.
              {decided.remediationDeadlineAt
                ? ` Resubmission is due by ${formatDateTime(decided.remediationDeadlineAt)}.`
                : ""}{" "}
              This record cannot be edited.
            </p>
          </Banner>
        ) : (
          <Banner title="Decided, and held for moderation" tone="info">
            <p>
              {learnerName} will not see this decision until moderation of this cohort is signed off. It cannot be
              edited; a moderator can return it for re-marking.
            </p>
          </Banner>
        )
      ) : null}
      {takenBySomeoneElse ? (
        <Banner title={`${takenBySomeoneElse} is marking this item`} tone="info">
          <p>You can read the evidence, but only they can mark it. Ask a coordinator to reallocate it if needed.</p>
        </Banner>
      ) : null}
      {problem ? <Banner title={problem} tone="critical" /> : null}

      <div className="workspace">
        <section aria-labelledby="evidence-h" className="workspace__evidence">
          <div className="viewer">
            <div className="viewer__toolbar">
              <h2 className="text-heading" id="evidence-h">
                Evidence
              </h2>
              {versions.length > 1 ? (
                <label className="cluster">
                  <span className="text-small">Version</span>
                  <span className="select">
                    <select onChange={(event) => setViewing(Number(event.target.value))} value={viewing}>
                      {versions.map((item) => (
                        <option key={item.version_number} value={item.version_number}>
                          Version {item.version_number}
                          {item.assessed ? " (being assessed)" : ""}
                        </option>
                      ))}
                    </select>
                  </span>
                </label>
              ) : null}
            </div>
            <div className="viewer__body stack">
              {shown && !shown.assessed && assessed ? (
                <Banner compact title={`You are viewing version ${shown.version_number}`} tone="info">
                  <p>The version being assessed is version {assessed.version_number}.</p>
                </Banner>
              ) : null}
              {shown?.files.length ? (
                <ul className="stack stack--sm">
                  {shown.files.map((file) => (
                    <li className="card" key={file.object_key}>
                      <div className="card__body cluster cluster--between">
                        <span className="stack stack--sm">
                          <span className="card__title">{file.filename}</span>
                          <span className="text-small text-muted">
                            {file.requirement ? `For ${file.requirement}` : "Not tied to a requirement"}
                          </span>
                        </span>
                        {links[file.object_key] ? (
                          <a
                            className="btn btn--secondary btn--sm"
                            href={links[file.object_key]}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open<span className="u-visually-hidden"> {file.filename} in a new tab</span>
                          </a>
                        ) : (
                          <span className="text-small text-muted">Link unavailable</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">This version has no files.</p>
              )}
            </div>
          </div>
        </section>

        <section aria-label="Marking" className="workspace__panel">
          <Tabs
            label="Marking panel"
            tabs={[
              { id: "rubric", label: "Rubric", content: rubric },
              { id: "feedback", label: "Feedback", content: feedback },
              { id: "history", label: "History", count: versions.length, content: history },
            ]}
          />
        </section>
      </div>

      <section aria-labelledby="decision-h" className="card u-mt-4">
        <div className="card__body stack">
          <h2 className="text-heading" id="decision-h">
            Decision
          </h2>
          <ChoiceGroup columns={2} legend="Outcome">
            <Choice
              checked={draft.outcome === "competent"}
              disabled={!canMark}
              name="outcome"
              onChange={() => change({ outcome: "competent" })}
              title="Competent"
              tone="positive"
              value="competent"
            />
            <Choice
              checked={draft.outcome === "not_yet_competent"}
              disabled={!canMark}
              name="outcome"
              onChange={() => change({ outcome: "not_yet_competent" })}
              title="Not yet competent"
              tone="caution"
              value="not_yet_competent"
            />
          </ChoiceGroup>
          <Field
            help="Why this outcome, against the criteria. It stays on record with the decision."
            label="Justification"
            markRequired
            name="justification"
          >
            {(control) => (
              <textarea
                {...control}
                className="textarea"
                disabled={!canMark}
                name={undefined}
                onChange={(event) => change({ justification: event.target.value })}
                rows={3}
                value={draft.justification}
              />
            )}
          </Field>
          {draft.outcome === "not_yet_competent" ? (
            <>
              <Field
                help="The actions the learner must take to reach competence."
                label="What the learner must do"
                markRequired
                name="remediation"
              >
                {(control) => (
                  <textarea
                    {...control}
                    className="textarea"
                    disabled={!canMark}
                    name={undefined}
                    onChange={(event) => change({ remediation: event.target.value })}
                    rows={3}
                    value={draft.remediation}
                  />
                )}
              </Field>
              <Field
                help={
                  moderated
                    ? "Counted from the day the result is released. The deadline date is set then."
                    : "Counted from the day the result is released, which in this cohort is when you finalise."
                }
                label="Days to resubmit"
                markRequired
                name="resubmission-days"
              >
                {(control) => (
                  <input
                    {...control}
                    className="input"
                    disabled={!canMark}
                    inputMode="numeric"
                    max={90}
                    min={1}
                    name={undefined}
                    onChange={(event) =>
                      change({ resubmissionDays: event.target.value === "" ? null : Number(event.target.value) })
                    }
                    type="number"
                    value={draft.resubmissionDays ?? ""}
                  />
                )}
              </Field>
            </>
          ) : null}

          <div className="cluster cluster--between">
            {saving ? (
              <StatusLine state="saving">Saving</StatusLine>
            ) : dirty ? (
              <StatusLine state="local">Not saved yet</StatusLine>
            ) : savedAt ? (
              <StatusLine state="saved" time={formatTime(savedAt)}>
                Draft saved
              </StatusLine>
            ) : (
              <span className="text-small text-muted">Nothing saved yet.</span>
            )}
            {canMark ? (
              <Button disabled={!dirty} loading={saving} loadingLabel="Saving the draft" onClick={save}>
                Save draft
              </Button>
            ) : !canTake ? null : (
              <Button
                loading={taking}
                loadingLabel="Taking the item"
                onClick={() =>
                  startTaking(async () => {
                    const result = await takeMarking(instanceId);
                    if (!result.ok) setProblem(result.message);
                  })
                }
                variant="primary"
              >
                Start marking
              </Button>
            )}
          </div>
          {canMark ? (
            <div className="stack stack--sm">
              {missing.length > 0 ? (
                <BlockedReason id="finalise-blocked">
                  Before this can be finalised it still needs {missing.join(", ")}.
                </BlockedReason>
              ) : null}
              {missing.length > 0 ? (
                <div>
                  <Button aria-describedby="finalise-blocked" disabled variant="primary">
                    Finalise decision
                  </Button>
                </div>
              ) : (
                <div>
                  <ConsequenceDialog
                    cancelLabel="Keep editing"
                    confirmLabel="Finalise decision"
                    consequence={consequence}
                    onConfirm={finalise}
                    title="Finalise this decision?"
                    trigger={{ label: finalising ? "Finalising" : "Finalise decision", variant: "primary" }}
                  >
                    <p>
                      {learnerName} · {draft.outcome === "competent" ? "Competent" : "Not yet competent"}
                    </p>
                    <p className="text-small text-muted">
                      You are finalising this decision as the assessor. It is kept permanently and cannot be edited; any
                      later decision is recorded beside it.
                    </p>
                  </ConsequenceDialog>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
