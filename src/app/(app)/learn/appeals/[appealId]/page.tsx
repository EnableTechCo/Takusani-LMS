import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Icon } from "@/components/ui/icons";
import { ButtonLink } from "@/components/ui/link";
import { Stepper } from "@/components/ui/process";
import { DateTime, Receipt } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, formatLongDayOf, formatTime, lastFullDayBefore } from "@/lib/dates";
import { getMyAppeal } from "@/modules/appeals/queries";
import {
  APPEAL_TYPE_LABELS,
  CATEGORY_LEARNER_LABELS,
  coordinatorsText,
  isOpen,
  LEARNER_STATE_LABELS,
  learnerSteps,
  pointsText,
  turnaroundText,
  type AppealState,
  type AppealType,
  type OutcomeCategory,
} from "@/modules/appeals/rules";
import { Paragraphs } from "@/modules/assessment/result-view";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";

export const metadata = { title: "Appeal" };

// L-17 (FR-604, FR-612, FR-613): the receipt, where the appeal stands with each step dated, and once decided, how it
// was decided, the new outcome and the reviewer's reasons. The reviewer is described, never named (UX Q7), and there
// is no way to appeal the outcome.
export default async function LearnAppealPage({
  params,
  searchParams,
}: {
  params: Promise<{ appealId: string }>;
  searchParams: Promise<{ lodged?: string }>;
}) {
  const [{ appealId }, flash] = await Promise.all([params, searchParams]);
  const appeal = await getMyAppeal(appealId);
  if (!appeal) notFound();

  const type = appeal.type as AppealType;
  const state = appeal.state as AppealState;
  const points = pointsText(appeal.points_scored ?? null, appeal.points_possible ?? null);
  const appealed = `${OUTCOME_LABELS[appeal.appealed_outcome]}${points ? `, ${points}` : ""}`;
  const lastDay = lastFullDayBefore(appeal.deadline_at, "long");
  const coordinators = coordinatorsText(appeal.coordinator_names ?? []);
  const events = (appeal.events ?? []) as unknown as { event: string; at: string }[];
  const checkedAt = events.find((entry) => entry.event === "admitted" || entry.event === "inadmissible")?.at ?? null;
  const allocatedAt = events.find((entry) => entry.event === "allocated")?.at ?? null;
  const reviewOpenedAt = events.find((entry) => entry.event === "review_opened")?.at ?? null;
  const concluded = state === "concluded" && appeal.outcome_category !== null && appeal.decided_outcome !== null;
  const now = new Date().getTime();
  const resubmitOpen =
    !concluded && appeal.remediation_deadline_at && new Date(appeal.remediation_deadline_at).getTime() > now;
  const decidedPoints = pointsText(appeal.decided_points ?? null, appeal.points_possible ?? null);
  const newDeadlineOpen =
    appeal.decided_remediation_deadline_at && new Date(appeal.decided_remediation_deadline_at).getTime() > now;

  return (
    <div className="page page--form">
      <PageHeader
        lead={`${appeal.item_title} · ${appeal.cohort_name}`}
        meta={
          concluded ? (
            <Tag tone="neutral">{CATEGORY_LEARNER_LABELS[appeal.outcome_category as OutcomeCategory]}</Tag>
          ) : (
            <Tag shape={isOpen(state) ? "half" : undefined} tone={isOpen(state) ? "info" : "neutral"}>
              {LEARNER_STATE_LABELS[state]}
            </Tag>
          )
        }
        title={`Appeal ${appeal.reference}`}
        workspace="Learning"
      />
      <div className="stack stack--lg">
        {flash.lodged ? (
          <Banner compact role="status" title="Your appeal has been lodged" tone="positive">
            <p>Keep the reference {appeal.reference} in case you need to ask about your appeal.</p>
          </Banner>
        ) : null}

        {concluded ? (
          // FR-612: how it was decided, the new outcome, and the reviewer's reasons. FR-613: final, with no appeal control.
          <section aria-labelledby="decision-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="decision-h">
                The decision on your appeal
              </h2>
              <Tag large tone={appeal.decided_outcome === "competent" ? "positive" : "caution"}>
                {OUTCOME_LABELS[appeal.decided_outcome!]}
              </Tag>
            </div>
            <div className="card__body stack">
              <p>
                <strong>{CATEGORY_LEARNER_LABELS[appeal.outcome_category as OutcomeCategory]}.</strong> Your result is
                now {OUTCOME_LABELS[appeal.decided_outcome!]}
                {decidedPoints ? `, ${decidedPoints}` : ""}. It was {appealed}.
              </p>
              <p className="text-small text-muted">
                Decided {appeal.concluded_at ? formatLongDayOf(appeal.concluded_at) : ""} by a reviewer who did not mark
                your work.
              </p>
              <div className="stack stack--sm">
                <h3 className="text-subheading">The reviewer&apos;s reasons</h3>
                <Paragraphs text={appeal.reasons ?? ""} />
              </div>
              {appeal.decided_remediation ? (
                <div className="stack stack--sm">
                  <h3 className="text-subheading">What to do next</h3>
                  <p>{appeal.decided_remediation}</p>
                  {appeal.decided_remediation_deadline_at ? (
                    <p className={newDeadlineOpen ? "deadline-line" : "deadline-line deadline-line--closed"}>
                      <Icon name={newDeadlineOpen ? "refresh" : "lock"} />
                      <span>
                        {newDeadlineOpen ? "You can resubmit " : "The time to resubmit ended "}
                        <span className="deadline-line__date">
                          {newDeadlineOpen ? "until " : "on "}
                          {formatLongDayOf(appeal.decided_remediation_deadline_at)} at{" "}
                          {formatTime(appeal.decided_remediation_deadline_at)} (SAST)
                        </span>
                        .
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
              <p className="deadline-line deadline-line--closed">
                <Icon name="lock" />
                <span>This decision is final. There is no further appeal.</span>
              </p>
            </div>
            <div className="card__footer">
              <ButtonLink href={`/learn/results/${appeal.result_id}`} variant="secondary">
                See your result
              </ButtonLink>
            </div>
          </section>
        ) : null}

        {state === "inadmissible" ? (
          // FR-605: the coordinator's reason, word for word.
          <Banner icon="scales" role="status" title="Your appeal was not accepted" tone="readonly">
            <p className="whitespace-pre-line">{appeal.admissibility_reason}</p>
            <p className="u-mt-2">If you have a question about this, ask {coordinators}.</p>
          </Banner>
        ) : null}

        {type === "view_script" && state === "admitted" ? (
          <Banner
            actions={
              <ButtonLink href={`/learn/appeals/${appeal.id}/script`} variant="primary">
                See your marked work
              </ButtonLink>
            }
            role="status"
            title="You can now see your marked work"
            tone="positive"
          >
            <p>Your work is shown next to the marks for each criterion and your assessor&apos;s feedback.</p>
          </Banner>
        ) : null}

        <Receipt
          note={
            <>
              What happens next: your appeal is checked first by {coordinators}. You should hear from us{" "}
              {turnaroundText(appeal.turnaround_working_days)}. You have also been sent this receipt in your
              notifications.
            </>
          }
          reference={appeal.reference}
          rows={[
            {
              label: "Learner",
              value: appeal.learner_number ? `${appeal.learner_name} · ${appeal.learner_number}` : appeal.learner_name,
            },
            { label: "Result", value: `${appeal.item_title}: ${appealed}` },
            { label: "You asked for", value: APPEAL_TYPE_LABELS[type] },
            {
              label: "Lodged",
              value: (
                <time dateTime={appeal.lodged_at}>
                  {formatLongDayOf(appeal.lodged_at)} at {formatTime(appeal.lodged_at)} (SAST)
                </time>
              ),
            },
            { label: "In time?", value: `Yes. The time to appeal closes at the end of ${lastDay}.` },
          ]}
          title="We have received your appeal"
        />

        <section aria-labelledby="progress-h" className="stack">
          <h2 className="text-heading" id="progress-h">
            Progress of your appeal
          </h2>
          <Stepper
            label={`Progress of your appeal ${appeal.reference}`}
            steps={learnerSteps({
              type,
              state,
              lodgedAt: appeal.lodged_at,
              checkedAt,
              allocatedAt,
              reviewOpenedAt,
              concludedAt: appeal.concluded_at ?? null,
            }).map((step) => ({
              label: step.label,
              state: step.state,
              meta: step.at ? formatDateTime(step.at) : undefined,
              body: step.body,
            }))}
          />
        </section>

        <section aria-labelledby="reasons-h" className="stack">
          <h2 className="text-heading" id="reasons-h">
            Your reasons
          </h2>
          <div className="card">
            <div className="card__body prose">
              <p className="whitespace-pre-line">{appeal.grounds}</p>
            </div>
          </div>
          <p className="text-small text-muted">
            Lodged <DateTime iso={appeal.lodged_at} zone />. The reasons cannot be changed once lodged.
          </p>
        </section>

        {resubmitOpen ? (
          <p className="deadline-line">
            <Icon name="refresh" />
            <span>
              Your appeal does not change your resubmission date. You can still resubmit {appeal.item_title}{" "}
              <span className="deadline-line__date">
                until {formatLongDayOf(appeal.remediation_deadline_at!)} at{" "}
                {formatTime(appeal.remediation_deadline_at!)} (SAST)
              </span>
              .
            </span>
          </p>
        ) : null}

        <div className="cluster">
          <ButtonLink href={`/learn/results/${appeal.result_id}`} variant="primary">
            Back to your result
          </ButtonLink>
          <ButtonLink href="/learn/appeals" variant="secondary">
            All your appeals
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
