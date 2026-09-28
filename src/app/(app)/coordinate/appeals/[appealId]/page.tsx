import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { DateTime, Log } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { formatLongDayOf, lastFullDayBefore } from "@/lib/dates";
import { getAppealToCoordinate } from "@/modules/appeals/queries";
import {
  APPEAL_TYPE_STAFF_LABELS,
  COORDINATOR_STATE_LABELS,
  isOpen,
  pointsText,
  turnaroundText,
  type AppealState,
  type AppealType,
} from "@/modules/appeals/rules";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";

export const metadata = { title: "Appeal · Coordinating" };

const EVENT_WORDS: Record<string, string> = {
  lodged: "lodged the appeal.",
};

// C-12 (FR-604): one appeal: who lodged it, what they asked for and why, the result appealed, and its steps.
// Accepting it and allocating a reviewer arrive with S3-02.
export default async function CoordinateAppealPage({ params }: { params: Promise<{ appealId: string }> }) {
  const appeal = await getAppealToCoordinate((await params).appealId);
  if (!appeal) notFound();

  const state = appeal.state as AppealState;
  const points = pointsText(appeal.points_scored ?? null, appeal.points_possible ?? null);
  const events = (appeal.events ?? []) as { event: string; at: string; actor_name: string | null }[];

  return (
    <div className="page">
      <PageHeader
        lead={`${appeal.learner_name}${appeal.learner_number ? ` · ${appeal.learner_number}` : ""} · ${appeal.item_title}, ${appeal.cohort_name}`}
        meta={
          <>
            <Tag
              shape={isOpen(state) ? "half" : undefined}
              tone={state === "lodged" ? "caution" : isOpen(state) ? "info" : "neutral"}
            >
              {COORDINATOR_STATE_LABELS[state]}
            </Tag>
            <span>{APPEAL_TYPE_STAFF_LABELS[appeal.type as AppealType]}</span>
          </>
        }
        title={`Appeal ${appeal.reference}`}
        workspace="Coordinating"
      />
      <div className="stack stack--lg">
        {state === "lodged" ? (
          <Banner role="note" title="Accepting an appeal online is not available yet" tone="info">
            <p>
              Until it is, tell the learner your decision directly. {appeal.learner_name} was promised a reply{" "}
              {turnaroundText(appeal.turnaround_working_days)} of lodging it on {formatLongDayOf(appeal.lodged_at)}.
            </p>
          </Banner>
        ) : null}

        <section aria-labelledby="grounds-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="grounds-h">
              The learner&apos;s reasons
            </h2>
          </div>
          <div className="card__body prose">
            <p className="whitespace-pre-line">{appeal.grounds}</p>
          </div>
        </section>

        <section aria-labelledby="result-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="result-h">
              The result appealed
            </h2>
          </div>
          <div className="card__body">
            <dl className="dl">
              <div className="dl__row">
                <dt>Outcome</dt>
                <dd>
                  {OUTCOME_LABELS[appeal.appealed_outcome]}
                  {points ? `, ${points}` : ""}
                </dd>
              </div>
              <div className="dl__row">
                <dt>Assessed by</dt>
                <dd>{appeal.assessor_name ?? "Not recorded"}</dd>
              </div>
              <div className="dl__row">
                <dt>Released</dt>
                <dd>
                  <DateTime iso={appeal.released_at} zone />
                </dd>
              </div>
              <div className="dl__row">
                <dt>Time to appeal</dt>
                <dd>Until the end of {lastFullDayBefore(appeal.deadline_at, "long")}; lodged in time</dd>
              </div>
            </dl>
          </div>
        </section>

        <section aria-labelledby="steps-h" className="stack">
          <h2 className="text-heading" id="steps-h">
            Steps so far
          </h2>
          <Log
            boxed
            entries={events.map((entry, index) => ({
              id: String(index),
              at: entry.at,
              actor: entry.actor_name ?? "The system",
              event: EVENT_WORDS[entry.event] ?? entry.event,
            }))}
            label={`Steps of appeal ${appeal.reference}`}
          />
        </section>

        <p>
          <TextLink href="/coordinate/appeals">All appeals</TextLink>
        </p>
      </div>
    </div>
  );
}
