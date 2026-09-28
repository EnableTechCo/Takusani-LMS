import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { DateTime, HistoryList } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, formatLongDayOf, formatTime } from "@/lib/dates";
import { openAppealReview } from "@/modules/appeals/queries";
import { ConcludeForm, type ReviewCriterion } from "@/modules/appeals/review-forms";
import { CATEGORY_STAFF_LABELS, turnaroundText, type OutcomeCategory } from "@/modules/appeals/rules";
import { signEvidence, type EvidenceFile } from "@/modules/assessment/queries";
import { MarksTable, Paragraphs, type Mark, type VersionFacts } from "@/modules/assessment/result-view";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { formatBytes } from "@/modules/submissions/rules";

export async function generateMetadata({ params }: { params: Promise<{ appealId: string }> }) {
  const review = await openAppealReview((await params).appealId);
  return { title: review?.status === "ok" ? `Appeal ${review.reference} · Appeal reviews` : "Appeal review" };
}

const DECISION_TYPES: Record<string, string> = {
  assessment: "Assessment",
  moderation: "Moderation",
  appeal: "Appeal decision",
  correction: "Correction",
};

interface DecisionRow {
  decision_id: string;
  type: string;
  outcome: string;
  decided_at: string;
  actor_name: string | null;
  version_number: number | null;
  current: boolean;
  appealed: boolean;
}

// R-02 (FR-609 to FR-611): the grounds, the work, the decision appealed with its marks, the chain of decisions and
// the moderation findings, then the reviewer's own marking and final decision.
export default async function ReviewAppealPage({
  params,
  searchParams,
}: {
  params: Promise<{ appealId: string }>;
  searchParams: Promise<{ concluded?: string }>;
}) {
  const [{ appealId }, flash] = await Promise.all([params, searchParams]);
  const review = await openAppealReview(appealId);
  if (!review || review.status !== "ok") notFound();

  const files = (review.files ?? []) as unknown as EvidenceFile[];
  const links = await signEvidence(files);
  const version = review.assessed_version as unknown as VersionFacts | null;
  const marks = (review.marks ?? []) as unknown as ReviewCriterion[];
  const decisions = (review.decisions ?? []) as unknown as DecisionRow[];
  const findings = (review.moderation_findings ?? []) as unknown as { decided_at: string; justification: string }[];
  const appealedOutcome = review.appealed_outcome as "competent" | "not_yet_competent";
  const conclusion = review.conclusion as unknown as {
    outcome: "competent" | "not_yet_competent";
    reasons: string;
    remediation: string | null;
    total: number | null;
  } | null;
  const concluded = review.state === "concluded";
  const possible = marks.some((mark) => mark.max_points !== null)
    ? marks.reduce((sum, mark) => sum + (mark.max_points ?? 0), 0)
    : null;
  const blocked = review.conflict || review.result_changed;

  return (
    <div className="page">
      <PageHeader
        lead={`${review.learner_name}${review.learner_number ? ` · ${review.learner_number}` : ""} · ${review.item_title}, ${review.cohort_name}`}
        meta={
          concluded && review.outcome_category ? (
            <Tag tone="neutral">{CATEGORY_STAFF_LABELS[review.outcome_category as OutcomeCategory]}</Tag>
          ) : (
            <Tag shape="half" tone="info">
              Under review
            </Tag>
          )
        }
        title={`Appeal ${review.reference}`}
        workspace="Appeal reviews"
      />
      <div className="page-layout">
        <div className="page-layout__main stack stack--lg">
          {flash.concluded ? (
            <Banner compact role="status" title="Your decision is recorded" tone="positive">
              <p>{review.learner_name}, the assessor and the coordinator have been told.</p>
            </Banner>
          ) : null}
          {review.conflict && !concluded ? (
            <Banner icon="scales" role="alert" title="You cannot decide this appeal" tone="critical">
              <p>
                You took an assessment decision on this work, so reviewing it would break separation of duties (BR-02).
                Tell the coordinator, who will reallocate it. Nothing has been recorded.
              </p>
            </Banner>
          ) : null}
          {review.result_changed && !review.conflict ? (
            <Banner icon="warning" role="alert" title="This result has a newer decision" tone="caution">
              <p>
                The result was decided again after the appeal was lodged, so this appeal can no longer be decided as it
                stands. Ask the coordinator what to do.
              </p>
            </Banner>
          ) : null}
          {!concluded ? (
            <p className="deadline-line">
              <Icon name="clock" />
              <span>
                {review.learner_name.split(" ")[0]} was promised a reply{" "}
                {turnaroundText(review.turnaround_working_days)} of lodging the appeal on{" "}
                {formatLongDayOf(review.lodged_at)}.
              </span>
            </p>
          ) : null}

          <section aria-labelledby="grounds-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="grounds-h">
                The learner&apos;s grounds
              </h2>
              <span className="text-meta">Lodged {formatDateTime(review.lodged_at)} SAST</span>
            </div>
            <div className="card__body prose">
              <blockquote>
                <p className="whitespace-pre-line">{review.grounds}</p>
              </blockquote>
            </div>
          </section>

          <section aria-labelledby="work-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="work-h">
                The work, as it was assessed
              </h2>
            </div>
            <div className="card__body stack">
              {version ? (
                <p className="text-small text-muted">
                  Version {version.version_number}, submitted <DateTime iso={version.submitted_at} zone />
                  {version.is_late ? " (late)" : ""}. Receipt <span className="mono">{version.receipt_reference}</span>.
                </p>
              ) : null}
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
            </div>
          </section>

          <section aria-labelledby="appealed-h" className="stack">
            <h2 className="text-heading" id="appealed-h">
              The decision appealed
            </h2>
            <p className="text-small text-muted">
              {OUTCOME_LABELS[appealedOutcome]}, decided {formatDateTime(review.appealed_at)} SAST
              {review.assessor_name ? ` by ${review.assessor_name}` : ""}.
            </p>
            <MarksTable itemTitle={review.item_title} marks={marks as Mark[]} outcome={appealedOutcome} />
            {review.appealed_feedback ? (
              <div className="stack stack--sm">
                <p className="text-subheading">The assessor&apos;s feedback</p>
                <Paragraphs text={review.appealed_feedback} />
              </div>
            ) : null}
            {review.appealed_remediation ? (
              <p className="text-small">
                <strong>What the learner was asked to do:</strong> {review.appealed_remediation}
              </p>
            ) : null}
          </section>

          {concluded && conclusion ? (
            <section aria-labelledby="outcome-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="outcome-h">
                  Your decision
                </h2>
                <Tag tone="neutral">{CATEGORY_STAFF_LABELS[review.outcome_category as OutcomeCategory]}</Tag>
              </div>
              <div className="card__body stack">
                <p>
                  <strong>
                    {OUTCOME_LABELS[conclusion.outcome]}
                    {conclusion.total !== null && possible !== null ? `, ${conclusion.total} of ${possible}` : ""}
                  </strong>
                  , recorded {review.concluded_at ? formatDateTime(review.concluded_at) : ""} SAST. It is final.
                </p>
                <Paragraphs text={conclusion.reasons} />
                {conclusion.remediation ? (
                  <p className="text-small">
                    <strong>What the learner must do:</strong> {conclusion.remediation}
                  </p>
                ) : null}
              </div>
            </section>
          ) : blocked ? null : (
            <section aria-labelledby="conclude-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="conclude-h">
                  Your marking and decision
                </h2>
              </div>
              <div className="card__body">
                <ConcludeForm
                  appealId={appealId}
                  appealedOutcome={appealedOutcome}
                  appealedRemediation={review.appealed_remediation ?? null}
                  criteria={marks}
                  itemTitle={review.item_title}
                  keptDeadline={
                    review.remediation_deadline_at
                      ? `${formatLongDayOf(review.remediation_deadline_at)} at ${formatTime(review.remediation_deadline_at)} (SAST)`
                      : null
                  }
                  learnerName={review.learner_name}
                  reference={review.reference}
                />
              </div>
            </section>
          )}
        </div>

        <aside aria-label="Decisions and moderation" className="page-layout__aside stack">
          <section aria-labelledby="chain-h" className="stack">
            <h2 className="text-subheading" id="chain-h">
              Decisions on this result
            </h2>
            <HistoryList
              entries={[...decisions].reverse().map((decision, index) => ({
                id: decision.decision_id,
                badge: String(decisions.length - index),
                title: `${DECISION_TYPES[decision.type] ?? decision.type}: ${OUTCOME_LABELS[decision.outcome]}`,
                meta: `${formatDateTime(decision.decided_at)}${decision.actor_name ? ` · ${decision.actor_name}` : ""}${
                  decision.version_number ? ` · version ${decision.version_number}` : ""
                }${decision.appealed ? " · appealed" : ""}`,
                current: decision.current,
              }))}
              label="Decisions on this result, newest first"
            />
          </section>
          <section aria-labelledby="findings-h" className="stack">
            <h2 className="text-subheading" id="findings-h">
              Moderation findings
            </h2>
            {findings.length === 0 ? (
              <p className="text-small text-muted">None. This result was not moderated.</p>
            ) : (
              <ul className="stack stack--sm">
                {findings.map((finding) => (
                  <li className="text-small" key={finding.decided_at}>
                    {formatDateTime(finding.decided_at)}: {finding.justification}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <p>
            <TextLink href="/review/appeals">All your reviews</TextLink>
          </p>
        </aside>
      </div>
    </div>
  );
}
