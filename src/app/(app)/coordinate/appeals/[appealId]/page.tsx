import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { DateTime, HistoryList, Log } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, formatLongDayOf, lastFullDayBefore } from "@/lib/dates";
import { AdmissibilityForm, ReviewerForm, type Candidate } from "@/modules/appeals/admin-forms";
import { getAppealToCoordinate, listAppealReviewerCandidates } from "@/modules/appeals/queries";
import {
  APPEAL_TYPE_STAFF_LABELS,
  CATEGORY_STAFF_LABELS,
  type OutcomeCategory,
  coordinatorStateLabel,
  isOpen,
  needsCoordinator,
  pointsText,
  TIER_DESCRIPTIONS,
  turnaroundText,
  type AppealType,
} from "@/modules/appeals/rules";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";

export const metadata = { title: "Appeal · Coordinating" };

interface AppealEvent {
  event: string;
  at: string;
  actor_name: string | null;
  reason: string | null;
  reviewer_name: string | null;
  tier: number | null;
  skip_reason: string | null;
  category: string | null;
}

interface DecisionRow {
  decision_id: string;
  type: string;
  outcome: string;
  decided_at: string;
  actor_name: string | null;
  version_number: number | null;
  current: boolean;
  appealed: boolean;
  justification: string | null;
}

const DECISION_TYPES: Record<string, string> = {
  assessment: "Assessment",
  moderation: "Moderation",
  appeal: "Appeal decision",
  correction: "Correction",
};

function eventWords(entry: AppealEvent, type: AppealType, learnerName: string): string {
  switch (entry.event) {
    case "lodged":
      return type === "remark" ? "lodged a re-mark request." : "asked to see the marked work.";
    case "admitted":
      return type === "remark"
        ? `admitted the appeal. ${learnerName} was told.`
        : `granted the view of the marked work. ${learnerName} was told.`;
    case "inadmissible":
      return `recorded the appeal as inadmissible. ${learnerName} was told, with the reason.`;
    case "allocated":
      return `allocated ${entry.reviewer_name} as reviewer (tier ${entry.tier}).`;
    case "reallocated":
      return `reallocated the review to ${entry.reviewer_name} (tier ${entry.tier}).`;
    case "review_opened":
      return "opened the review.";
    case "concluded":
      return `decided the appeal: ${entry.category ? CATEGORY_STAFF_LABELS[entry.category as OutcomeCategory].toLowerCase() : "concluded"}. The decision is final and was released at once.`;
    case "conclusion_refused":
      return "tried to record a decision. Refused: they took an assessment decision on this work.";
    case "script_viewed":
      return "opened the marked work.";
    case "allocation_refused":
      return `tried to allocate ${entry.reviewer_name} as reviewer. Refused: they took an assessment decision on this work.`;
    default:
      return entry.event;
  }
}

// C-12 (FR-604, FR-605, FR-608): one appeal. The coordinator checks it, and for a re-mark chooses a reviewer who took
// no assessment decision on the work (BR-02, AS-02).
export default async function CoordinateAppealPage({
  params,
  searchParams,
}: {
  params: Promise<{ appealId: string }>;
  searchParams: Promise<{ decided?: string; allocated?: string }>;
}) {
  const [{ appealId }, flash] = await Promise.all([params, searchParams]);
  const appeal = await getAppealToCoordinate(appealId);
  if (!appeal) notFound();

  const type = appeal.type as AppealType;
  const state = appeal.state;
  const points = pointsText(appeal.points_scored ?? null, appeal.points_possible ?? null);
  const events = (appeal.events ?? []) as unknown as AppealEvent[];
  const decisions = (appeal.decisions ?? []) as unknown as DecisionRow[];
  const views = events.filter((entry) => entry.event === "script_viewed");
  const appealDecision = decisions.find((decision) => decision.type === "appeal" && decision.current) ?? null;
  const needsReviewer = type === "remark" && ["admitted", "allocated", "under_review"].includes(state);
  const candidates = needsReviewer ? ((await listAppealReviewerCandidates(appeal.id)) as unknown as Candidate[]) : [];
  const firstName = appeal.learner_name.split(" ")[0];

  return (
    <div className="page">
      <PageHeader
        lead={`${appeal.learner_name}${appeal.learner_number ? ` · ${appeal.learner_number}` : ""} · ${appeal.item_title}, ${appeal.cohort_name}`}
        meta={
          <>
            <Tag
              shape={isOpen(state) ? "half" : undefined}
              tone={needsCoordinator(type, state) ? "caution" : isOpen(state) ? "info" : "neutral"}
            >
              {coordinatorStateLabel(type, state)}
            </Tag>
            <span>{APPEAL_TYPE_STAFF_LABELS[type]}</span>
          </>
        }
        title={`Appeal ${appeal.reference}`}
        workspace="Coordinating"
      />
      <div className="page-layout">
        <div className="page-layout__main stack stack--lg">
          {flash.decided === "admit" ? (
            <Banner compact role="status" title="Appeal accepted" tone="positive">
              <p>
                {appeal.learner_name} has been told.{type === "remark" ? " Now choose a reviewer." : ""}
              </p>
            </Banner>
          ) : null}
          {flash.decided === "inadmissible" ? (
            <Banner compact role="status" title="Recorded as inadmissible" tone="positive">
              <p>{appeal.learner_name} has been told, with your reason.</p>
            </Banner>
          ) : null}
          {flash.allocated ? (
            <Banner compact role="status" title="Reviewer allocated" tone="positive">
              <p>{appeal.reviewer_name} has been told.</p>
            </Banner>
          ) : null}

          {isOpen(state) ? (
            <p className="deadline-line">
              <Icon name="clock" />
              <span>
                {firstName} was promised a reply {turnaroundText(appeal.turnaround_working_days)} of lodging the appeal
                on {formatLongDayOf(appeal.lodged_at)}.
              </span>
            </p>
          ) : null}

          <section aria-labelledby="grounds-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="grounds-h">
                What {firstName} asked for
              </h2>
              <span className="text-meta">Lodged {formatDateTime(appeal.lodged_at)} SAST</span>
            </div>
            <div className="card__body stack">
              <dl className="dl dl--inline">
                <div className="dl__row">
                  <dt>Request</dt>
                  <dd>
                    {type === "remark"
                      ? "A re-mark. They confirmed they understand the mark can go down as well as up."
                      : "To see the work with the marks and the assessor's feedback."}
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Inside the window?</dt>
                  <dd>
                    Yes. Released {formatDateTime(appeal.released_at)} SAST. The window runs to the end of{" "}
                    {lastFullDayBefore(appeal.deadline_at, "long")}.
                  </dd>
                </div>
              </dl>
              <div>
                <p className="text-subheading">Their reasons, as they wrote them</p>
                <div className="prose u-mt-2">
                  <blockquote>
                    <p className="whitespace-pre-line">{appeal.grounds}</p>
                  </blockquote>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="result-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="result-h">
                The result being appealed
              </h2>
            </div>
            <div className="card__body stack">
              <dl className="dl dl--inline">
                <div className="dl__row">
                  <dt>Outcome appealed</dt>
                  <dd>
                    {OUTCOME_LABELS[appeal.appealed_outcome]}
                    {points ? `, ${points}` : ""}
                    {appeal.assessor_name ? `, decided by ${appeal.assessor_name}` : ""}
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Released</dt>
                  <dd>
                    <DateTime iso={appeal.released_at} zone />
                  </dd>
                </div>
              </dl>
              <HistoryList
                entries={[...decisions].reverse().map((decision, index) => ({
                  id: decision.decision_id,
                  badge: String(decisions.length - index),
                  title: `${DECISION_TYPES[decision.type] ?? decision.type}: ${OUTCOME_LABELS[decision.outcome]}${
                    decision.version_number ? ` (version ${decision.version_number})` : ""
                  }`,
                  meta: `${formatDateTime(decision.decided_at)}${decision.actor_name ? ` · ${decision.actor_name}` : ""}${
                    decision.appealed ? " · the decision appealed" : ""
                  }`,
                  current: decision.current,
                }))}
                label="Decisions on this result, newest first"
              />
            </div>
          </section>

          {state === "lodged" ? (
            <section aria-labelledby="adm-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="adm-h">
                  Admissibility decision
                </h2>
              </div>
              <div className="card__body">
                <AdmissibilityForm
                  appealId={appeal.id}
                  itemTitle={appeal.item_title}
                  learnerName={appeal.learner_name}
                  reference={appeal.reference}
                  turnaroundWorkingDays={appeal.turnaround_working_days}
                  type={type}
                />
              </div>
            </section>
          ) : null}

          {state === "inadmissible" ? (
            <section aria-labelledby="inadm-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="inadm-h">
                  Not accepted
                </h2>
              </div>
              <div className="card__body stack">
                <p className="prose whitespace-pre-line">{appeal.admissibility_reason}</p>
                <p className="text-small text-muted">
                  Recorded {appeal.admissibility_decided_at ? formatDateTime(appeal.admissibility_decided_at) : ""} SAST
                  by {appeal.admissibility_decided_by_name}. {appeal.learner_name} was told, with this reason.
                </p>
              </div>
            </section>
          ) : null}

          {type === "view_script" && state === "admitted" ? (
            <Banner role="status" title="The view of the marked work was granted" tone="info">
              <p>
                Granted {appeal.admissibility_decided_at ? formatDateTime(appeal.admissibility_decided_at) : ""} SAST by{" "}
                {appeal.admissibility_decided_by_name}. {appeal.learner_name} was told.{" "}
                {views.length === 0
                  ? "They have not opened it yet."
                  : `They first opened it ${formatDateTime(views[0].at)} SAST, and have opened it ${
                      views.length === 1 ? "once" : `${views.length} times`
                    }.`}
              </p>
            </Banner>
          ) : null}

          {type === "remark" && state === "admitted" ? (
            <section aria-labelledby="alloc-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="alloc-h">
                  Choose a reviewer
                </h2>
              </div>
              <div className="card__body">
                <ReviewerForm
                  appealId={appeal.id}
                  candidates={candidates}
                  itemTitle={appeal.item_title}
                  learnerName={appeal.learner_name}
                  reallocating={false}
                  reference={appeal.reference}
                />
              </div>
            </section>
          ) : null}

          {appeal.reviewer_name && (state === "allocated" || state === "under_review") ? (
            <section aria-labelledby="rev-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="rev-h">
                  Reviewer
                </h2>
                <Tag shape="half" tone="info">
                  {state === "under_review" ? "Under review" : "Allocated"}
                </Tag>
              </div>
              <div className="card__body stack">
                <dl className="dl dl--inline">
                  <div className="dl__row">
                    <dt>Reviewer</dt>
                    <dd>
                      {appeal.reviewer_name}
                      {appeal.reviewer_tier ? `, ${TIER_DESCRIPTIONS[appeal.reviewer_tier]}` : ""}
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Allocated</dt>
                    <dd>
                      <DateTime iso={appeal.allocated_at!} zone />. They were notified.
                    </dd>
                  </div>
                </dl>
                <details className="delivery-evidence">
                  <summary>Reallocate the review of appeal {appeal.reference}</summary>
                  <div className="u-mt-4">
                    <ReviewerForm
                      appealId={appeal.id}
                      candidates={candidates}
                      itemTitle={appeal.item_title}
                      learnerName={appeal.learner_name}
                      reallocating
                      reference={appeal.reference}
                    />
                  </div>
                </details>
              </div>
            </section>
          ) : null}
          {state === "concluded" && appeal.outcome_category && appealDecision ? (
            <section aria-labelledby="out-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="out-h">
                  Outcome
                </h2>
                <Tag tone="neutral">{CATEGORY_STAFF_LABELS[appeal.outcome_category as OutcomeCategory]}</Tag>
              </div>
              <div className="card__body stack">
                <dl className="dl dl--inline">
                  <div className="dl__row">
                    <dt>New decision</dt>
                    <dd>
                      {OUTCOME_LABELS[appealDecision.outcome]}. It was {OUTCOME_LABELS[appeal.appealed_outcome]}
                      {points ? `, ${points}` : ""}.
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Recorded</dt>
                    <dd>
                      {formatDateTime(appealDecision.decided_at)} SAST by {appealDecision.actor_name}, as the appeal
                      reviewer
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Release</dt>
                    <dd>Released at once. An appeal decision is never held for moderation, and it is final.</dd>
                  </div>
                </dl>
                {appealDecision.justification ? (
                  <div>
                    <p className="text-subheading">The reviewer&apos;s reasons</p>
                    <p className="prose u-mt-2 whitespace-pre-line">{appealDecision.justification}</p>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>

        <aside aria-label="Appeal record" className="page-layout__aside stack">
          <h2 className="text-subheading">Appeal record</h2>
          <Log
            boxed
            entries={events.map((entry, index) => ({
              id: String(index),
              at: entry.at,
              actor: entry.actor_name ?? "The system",
              event: eventWords(entry, type, appeal.learner_name),
              detail:
                entry.event === "inadmissible" && entry.reason
                  ? `Reason: ${entry.reason}`
                  : entry.skip_reason
                    ? `Earlier group passed over: ${entry.skip_reason}`
                    : entry.event === "allocation_refused"
                      ? "separation_of_duties_conflict"
                      : undefined,
              marked: entry.event === "allocation_refused" || entry.event === "conclusion_refused",
            }))}
            label={`Record of appeal ${appeal.reference}, oldest first. Times in SAST.`}
          />
          <p>
            <TextLink href="/coordinate/appeals">All appeals</TextLink>
          </p>
        </aside>
      </div>
    </div>
  );
}
