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
  coordinatorsText,
  isOpen,
  LEARNER_STATE_LABELS,
  learnerSteps,
  pointsText,
  turnaroundText,
  type AppealState,
  type AppealType,
} from "@/modules/appeals/rules";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";

export const metadata = { title: "Appeal" };

// L-17 (FR-604, FR-612): the receipt, where the appeal stands, and the learner's reasons. The outcome and the
// reviewer's reasons join this page when appeals are decided (S3-04, S3-05).
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
  const resubmitOpen =
    appeal.remediation_deadline_at && new Date(appeal.remediation_deadline_at).getTime() > new Date().getTime();

  return (
    <div className="page page--form">
      <PageHeader
        lead={`${appeal.item_title} · ${appeal.cohort_name}`}
        meta={
          <Tag shape={isOpen(state) ? "half" : undefined} tone={isOpen(state) ? "info" : "neutral"}>
            {LEARNER_STATE_LABELS[state]}
          </Tag>
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
            steps={learnerSteps({ type, state, lodgedAt: appeal.lodged_at }).map((step) => ({
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
                until the end of {lastFullDayBefore(appeal.remediation_deadline_at!, "long")}
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
