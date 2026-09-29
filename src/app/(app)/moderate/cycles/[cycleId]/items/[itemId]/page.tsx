import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ConflictPanel } from "@/components/ui/conflict";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { DateTime, HistoryList } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, formatDay } from "@/lib/dates";
import { signEvidence, type EvidenceFile } from "@/modules/assessment/queries";
import { MarksTable, Paragraphs, type Mark, type VersionFacts } from "@/modules/assessment/result-view";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { getMyAccess } from "@/modules/identity/session";
import { FindingForm } from "@/modules/moderation/review-forms";
import { openSampleItem } from "@/modules/moderation/review-queries";
import {
  dueText,
  FINDING_LABELS,
  INCLUSION_LABELS,
  isOverdue,
  ITEM_STATE_LABELS,
  inclusionText,
  itemPositionText,
  itemStateTone,
  progressText,
} from "@/modules/moderation/review-rules";
import { formatBytes } from "@/modules/submissions/rules";

export async function generateMetadata({ params }: { params: Promise<{ cycleId: string; itemId: string }> }) {
  const item = await openSampleItem((await params).itemId);
  return {
    title: item ? `${itemPositionText(item.seq, item.total)}: ${item.learner_name} · Moderating` : "Item · Moderating",
  };
}

interface DecisionRow {
  decision_id: string;
  type: string;
  outcome: string;
  decided_at: string;
  actor_name: string | null;
  version_number: number | null;
  justification: string;
  current: boolean;
}

interface FindingRow {
  finding_id: string;
  finding: string;
  reasons: string;
  recorded_at: string;
  moderator_name: string;
  on_current: boolean;
}

interface ReturnRow {
  return_id: string;
  corrections: string;
  due_on: string;
  returned_at: string;
  remarked_at: string | null;
  moderator_name: string;
  assessor_name: string;
}

// M-03 (P0-12; FR-507, FR-508, FR-509; BR-01): everything about one sampled item on one route: why it is in the
// sample, the work and its evidence, the assessor's decision, the marks, the finding form with the return, and the
// findings and returns so far. A moderator who assessed the work sees the conflict named and no evidence.
export default async function SampleItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ cycleId: string; itemId: string }>;
  searchParams: Promise<{ recorded?: string }>;
}) {
  const [{ cycleId, itemId }, flash] = await Promise.all([params, searchParams]);
  const [item, access] = await Promise.all([openSampleItem(itemId), getMyAccess()]);
  if (!item || item.cycle_id !== cycleId) notFound();

  const position = itemPositionText(item.seq, item.total);
  const nav = (
    <>
      {item.previous_item_id ? (
        <ButtonLink href={`/moderate/cycles/${cycleId}/items/${item.previous_item_id}`} variant="secondary">
          Previous<span className="u-visually-hidden"> item</span>
        </ButtonLink>
      ) : null}
      {item.next_item_id ? (
        <ButtonLink href={`/moderate/cycles/${cycleId}/items/${item.next_item_id}`} variant="secondary">
          Next<span className="u-visually-hidden"> item</span>
        </ButtonLink>
      ) : null}
    </>
  );

  if (item.status !== "ok") {
    const conflicts = (item.conflict ?? []) as unknown as { outcome: string; decided_at: string }[];
    return (
      <div className="page">
        <PageHeader
          actions={nav}
          lead={`${item.cycle_name}, ${item.cohort_name}`}
          title={`${position}: you cannot moderate this item`}
          workspace="Moderating"
        />
        <ConflictPanel
          actions={
            <ButtonLink href={`/moderate/cycles/${cycleId}`} variant="primary">
              Back to the cycle
            </ButtonLink>
          }
          evidence={conflicts.map((conflict, index) => ({
            term: index === 0 ? "Your decision on this result" : "And",
            detail: `${OUTCOME_LABELS[conflict.outcome as "competent" | "not_yet_competent"] ?? conflict.outcome}, decided ${formatDateTime(conflict.decided_at)} (SAST)`,
          }))}
          rule="BR-01 · separation_of_duties_conflict"
          title="This would break separation of duties"
        >
          You took an assessment decision on this work, so you cannot be its moderator. Nothing was recorded, and the
          evidence is not shown to you here. The coordinator can reallocate the item; you need do nothing.
        </ConflictPanel>
      </div>
    );
  }

  const files = (item.files ?? []) as unknown as EvidenceFile[];
  const links = await signEvidence(files);
  const marks = (item.marks ?? []) as unknown as Mark[];
  const version = item.assessed_version as unknown as VersionFacts | null;
  const decisions = (item.decisions ?? []) as unknown as DecisionRow[];
  const findings = (item.findings ?? []) as unknown as FindingRow[];
  const returns = (item.returns ?? []) as unknown as ReturnRow[];
  const openReturn = returns.find((row) => row.remarked_at === null) ?? null;
  const outcome = item.outcome as "competent" | "not_yet_competent";
  const concluded = item.state === "agreed";
  const open = item.cycle_state === "frozen";
  const revised = decisions.length > 1;
  const now = new Date();

  return (
    <div className="page">
      <PageHeader
        actions={nav}
        lead={`${item.learner_name}${item.learner_number ? ` · ${item.learner_number}` : ""} · ${item.item_title} · ${item.cycle_name}, ${item.cohort_name}`}
        meta={<Tag tone={itemStateTone(item.state)}>{ITEM_STATE_LABELS[item.state] ?? item.state}</Tag>}
        title={`${position}: ${item.learner_name}, ${item.item_title}`}
        workspace="Moderating"
      />
      <div className="stack stack--lg">
        {flash.recorded ? (
          <Banner
            compact
            role="status"
            title={
              flash.recorded === "agree"
                ? "You agreed with the decision. This item is concluded."
                : `Returned to ${item.assessor_name ?? "the assessor"} for re-marking. They and the coordinator have been told.`
            }
            tone="positive"
          >
            <p>
              {progressText(item.my_concluded, item.my_items)}{" "}
              {item.next_item_id ? (
                <TextLink href={`/moderate/cycles/${cycleId}/items/${item.next_item_id}`}>Next item</TextLink>
              ) : (
                <TextLink href={`/moderate/cycles/${cycleId}`}>Back to the cycle</TextLink>
              )}
            </p>
          </Banner>
        ) : null}

        {openReturn ? (
          <Banner
            role="note"
            title={`Returned to ${openReturn.assessor_name}: ${dueText(openReturn.due_on, now)}`}
            tone={isOverdue(openReturn.due_on, now) ? "caution" : "info"}
          >
            <p>
              Returned {formatDateTime(openReturn.returned_at)} (SAST). Nothing more can be recorded until they finalise
              the re-mark; you are told when they do. The cohort cannot be signed off while this is open.
            </p>
            <p className="whitespace-pre-line">
              <strong>Required corrections:</strong> {openReturn.corrections}
            </p>
          </Banner>
        ) : item.state === "remarked" && returns[0] ? (
          <Banner role="note" title="Re-marked: review the revised decision" tone="info">
            <p>
              {returns[0].assessor_name} re-marked it on {formatDateTime(returns[0].remarked_at!)} (SAST), after your
              return of {formatDateTime(returns[0].returned_at)}. The original decision is below, kept on record. Agree
              with the revised decision, or return it again.
            </p>
          </Banner>
        ) : null}

        <section aria-labelledby="why-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="why-h">
              Why this item is in the sample
            </h2>
          </div>
          <div className="card__body">
            <dl className="dl">
              <div className="dl__row">
                <dt>Included because</dt>
                <dd>
                  <Tag plain>{INCLUSION_LABELS[item.inclusion_reason] ?? item.inclusion_reason}</Tag>{" "}
                  {inclusionText(item.inclusion_reason, item.stratum, item.assessor_name)}
                </dd>
              </div>
              <div className="dl__row">
                <dt>Stratum</dt>
                <dd>{item.stratum}</dd>
              </div>
              <div className="dl__row">
                <dt>Independence</dt>
                <dd>You did not assess this work. Assessor: {item.assessor_name ?? "unknown"}.</dd>
              </div>
              <div className="dl__row">
                <dt>Your progress</dt>
                <dd>
                  {progressText(item.my_concluded, item.my_items)}{" "}
                  <TextLink href={`/moderate/cycles/${cycleId}`}>Back to the cycle</TextLink>
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            <section aria-labelledby="work-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="work-h">
                  Submission and evidence
                </h2>
              </div>
              <div className="card__body stack">
                {version ? (
                  <p className="text-small text-muted">
                    Version {version.version_number}, submitted <DateTime iso={version.submitted_at} zone />
                    {version.is_late ? " (late)" : ""}. Receipt{" "}
                    <span className="mono">{version.receipt_reference}</span>.
                  </p>
                ) : null}
                {files.length === 0 ? (
                  <p className="text-muted">No files were handed in with this version.</p>
                ) : (
                  <ul className="stack stack--sm">
                    {files.map((file) => (
                      <li className="cluster cluster--between" key={file.object_key}>
                        <span>
                          {links[file.object_key] ? (
                            <a download={file.filename} href={links[file.object_key]}>
                              {file.filename}
                            </a>
                          ) : (
                            file.filename
                          )}
                          {file.requirement ? <span className="text-muted"> · {file.requirement}</span> : null}
                        </span>
                        <span className="text-meta mono">{formatBytes(file.bytes)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            <section aria-labelledby="decision-h" className="stack">
              <h2 className="text-heading" id="decision-h">
                The assessor&apos;s decision
              </h2>
              <p className="text-small text-muted">
                {OUTCOME_LABELS[outcome]}, decided {formatDateTime(item.decided_at!)} SAST
                {item.assessor_name ? ` by ${item.assessor_name}` : ""}
                {revised ? " (a re-mark; the original is below)" : ""}. The result stays held until the cycle is signed
                off.
              </p>
              <div className="stack stack--sm">
                <p className="text-subheading">Justification</p>
                <Paragraphs text={item.justification ?? ""} />
              </div>
              {item.feedback ? (
                <div className="stack stack--sm">
                  <p className="text-subheading">Feedback to the learner</p>
                  <Paragraphs text={item.feedback} />
                </div>
              ) : null}
              {item.remediation ? (
                <p className="text-small">
                  <strong>What the learner must do:</strong> {item.remediation}
                  {item.resubmission_days ? ` Resubmission period: ${item.resubmission_days} days from release.` : ""}
                </p>
              ) : null}
              <MarksTable itemTitle={item.item_title} marks={marks} outcome={outcome} />
              {revised ? (
                <HistoryList
                  entries={decisions.map((decision, index) => ({
                    id: decision.decision_id,
                    badge: String(decisions.length - index),
                    title: `${OUTCOME_LABELS[decision.outcome as "competent" | "not_yet_competent"] ?? decision.outcome}${decision.current ? "" : " (replaced, kept on record)"}`,
                    meta: `${formatDateTime(decision.decided_at)} · ${decision.actor_name ?? "unknown"}${decision.version_number ? ` · version ${decision.version_number}` : ""} · ${decision.justification}`,
                    current: decision.current,
                  }))}
                  label="Decisions on this result, newest first"
                />
              ) : null}
            </section>

            <section aria-labelledby="finding-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="finding-h">
                  Your finding
                </h2>
              </div>
              <div className="card__body stack">
                {!open ? (
                  <p className="text-muted">This cycle is signed off, so nothing more can be recorded.</p>
                ) : concluded ? (
                  <p className="text-muted">
                    You agreed with this decision. It is concluded; the result is released when the cycle is signed off.
                  </p>
                ) : openReturn ? (
                  <p className="text-muted">
                    This item is with {openReturn.assessor_name} for re-marking. {dueText(openReturn.due_on, now)}. You
                    review it again once they finalise.
                  </p>
                ) : (
                  <>
                    <p className="text-small text-muted">
                      A finding is never edited: each one is added to the item&apos;s history. Reasons are required
                      whether you agree or disagree; disagreeing returns the item to the assessor.
                    </p>
                    <FindingForm
                      assessorName={item.assessor_name ?? "the assessor"}
                      cycleId={cycleId}
                      itemId={itemId}
                      moderatorName={access?.full_name ?? "you"}
                      revised={revised}
                    />
                  </>
                )}
              </div>
            </section>
          </div>

          <aside aria-labelledby="findings-h" className="page-layout__aside stack">
            <h2 className="text-heading" id="findings-h">
              Findings on this item
            </h2>
            {findings.length === 0 ? (
              <p className="text-small text-muted">No finding has been recorded yet.</p>
            ) : (
              <HistoryList
                entries={findings.map((finding, index) => ({
                  id: finding.finding_id,
                  badge: String(findings.length - index),
                  title: FINDING_LABELS[finding.finding] ?? finding.finding,
                  meta: `${formatDateTime(finding.recorded_at)} · ${finding.moderator_name}${finding.on_current ? "" : " · on the earlier decision"} · "${finding.reasons}"`,
                  current: index === 0,
                }))}
                label="Findings, newest first"
              />
            )}
            {returns.length > 0 ? (
              <>
                <h2 className="text-heading" id="returns-h">
                  Returns
                </h2>
                <HistoryList
                  entries={returns.map((row, index) => ({
                    id: row.return_id,
                    badge: String(returns.length - index),
                    title: row.remarked_at
                      ? `Re-marked ${formatDateTime(row.remarked_at)}`
                      : `With ${row.assessor_name}, ${dueText(row.due_on, now)}`,
                    meta: `Returned ${formatDateTime(row.returned_at)} by ${row.moderator_name}, due ${formatDay(row.due_on)} · "${row.corrections}"`,
                    current: row.remarked_at === null,
                  }))}
                  label="Returns, newest first"
                />
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
