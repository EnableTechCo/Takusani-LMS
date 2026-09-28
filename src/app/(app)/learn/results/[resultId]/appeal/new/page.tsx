import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Icon } from "@/components/ui/icons";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { DateTime } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { formatLongDayOf, lastFullDayBefore } from "@/lib/dates";
import { LodgeAppealForm, type LodgeFacts } from "@/modules/appeals/forms";
import { getAppealOptions } from "@/modules/appeals/queries";
import { coordinatorsText, pointsText } from "@/modules/appeals/rules";
import { appealWindow, OUTCOME_LABELS } from "@/modules/assessment/rules";

export const metadata = { title: "Appeal your result" };

// L-16 (P0-08; FR-601 to FR-604, FR-613): choose the kind, give reasons, confirm. The window is shown before the form
// and checked again by the database when the appeal is lodged.
export default async function LearnAppealNewPage({ params }: { params: Promise<{ resultId: string }> }) {
  const options = await getAppealOptions((await params).resultId);
  if (!options) notFound();

  const now = new Date();
  const window = appealWindow(options.appeal_deadline_at, now);
  const outcome = OUTCOME_LABELS[options.outcome];
  const points = pointsText(options.points_scored ?? null, options.points_possible ?? null);
  const resultText = points ? `${outcome}, ${points}` : outcome;
  const resubmitOpen =
    options.remediation_deadline_at && new Date(options.remediation_deadline_at).getTime() > now.getTime();
  const resubmitUntil = resubmitOpen
    ? `the end of ${lastFullDayBefore(options.remediation_deadline_at!, "long")}`
    : null;
  const coordinators = coordinatorsText(options.coordinator_names ?? []);
  const back = `/learn/results/${options.result_id}`;

  const remarkBlocked: LodgeFacts["remarkBlocked"] =
    options.remark_standing === "available"
      ? null
      : {
          open: options.remark_standing === "open",
          appealId: options.remark_appeal_id!,
          reference: options.remark_reference!,
          reason:
            options.remark_standing === "open"
              ? `You lodged appeal ${options.remark_reference} on ${formatLongDayOf(options.remark_lodged_at!)}, and it is being dealt with.`
              : `Appeal ${options.remark_reference} was a re-mark of this result.`,
        };
  const scriptBlocked: LodgeFacts["scriptBlocked"] = options.open_script_appeal_id
    ? { appealId: options.open_script_appeal_id, reference: options.open_script_reference! }
    : null;
  const nothingLeft = remarkBlocked !== null && scriptBlocked !== null;

  return (
    <div className="page page--form">
      <PageHeader
        lead={
          window.state === "closed" || options.decision_final
            ? undefined
            : "An appeal asks us to look again at how your work was marked. Lodging an appeal does not count against you."
        }
        title={`Appeal your result for ${options.item_title}`}
        workspace="Learning"
      />
      <div className="stack stack--lg">
        {/* The result being appealed, with the closing day repeated (P0-08). */}
        <section aria-labelledby="summary-h" className="stack">
          <h2 className="u-visually-hidden" id="summary-h">
            The result you are appealing
          </h2>
          <div className="card">
            <div className="card__body cluster cluster--between">
              <div className="stack stack--sm">
                <p className="text-overline">
                  {options.item_title} · {options.cohort_name}
                </p>
                <p>
                  <Tag tone={options.outcome === "competent" ? "positive" : "caution"}>{outcome}</Tag>{" "}
                  <span className="text-muted">
                    {points ? `${points} · ` : ""}released <DateTime iso={options.released_at} />
                  </span>
                </p>
              </div>
              <TextLink href={back}>See the result and feedback</TextLink>
            </div>
          </div>
          {options.decision_final ? null : window.state === "closed" ? (
            <p className="deadline-line deadline-line--closed">
              <Icon name="lock" />
              <span>The time to appeal closed at the end of {window.lastDay}.</span>
            </p>
          ) : (
            <p className={window.state === "last_day" ? "deadline-line deadline-line--soon" : "deadline-line"}>
              <Icon name="clock" />
              <span>
                {window.state === "last_day" ? (
                  <>
                    <strong>Today is the last day to appeal.</strong> You can lodge an appeal{" "}
                    <span className="deadline-line__date">until the end of today, {window.lastDay}</span>.
                  </>
                ) : (
                  <>
                    You can lodge an appeal{" "}
                    <span className="deadline-line__date">until the end of {window.lastDay}</span>.{" "}
                    <span className="deadline-line__left">
                      {window.daysLeft === 1 ? "1 day" : `${window.daysLeft} days`} left
                    </span>
                    , including weekends and public holidays.
                  </>
                )}
              </span>
            </p>
          )}
        </section>

        {options.decision_final ? (
          <Banner icon="scales" role="note" title="This result was decided on appeal" tone="readonly">
            <p>That decision is final. There is no further appeal.</p>
          </Banner>
        ) : window.state === "closed" ? (
          // FR-603: the form is replaced by the rule and what the learner can still do.
          <section aria-labelledby="closed-h" className="stack">
            <h2 className="text-heading" id="closed-h">
              An appeal can no longer be lodged for this result
            </h2>
            <div className="prose">
              <p>
                You had 7 days to appeal, counted from {formatLongDayOf(options.released_at)}, the day your result was
                released and you were told. That time ended at the end of {window.lastDay}. The rule is the same for
                every learner, so we cannot accept an appeal after that day.
              </p>
              <p>What you can still do:</p>
              <ul>
                {resubmitUntil ? (
                  <li>
                    Resubmit your work. You have <strong>until {resubmitUntil}</strong>.
                  </li>
                ) : null}
                <li>Ask {coordinators} a question about your result.</li>
              </ul>
            </div>
            <div className="cluster">
              <ButtonLink href={back} variant="secondary">
                Back to your result
              </ButtonLink>
            </div>
          </section>
        ) : nothingLeft ? (
          <Banner
            icon="scales"
            role="status"
            title="There is no other appeal you can lodge for this result"
            tone="info"
          >
            <p>
              {remarkBlocked.reason} You also asked to see your work with the marks, and that request is still open.{" "}
              <TextLink href={`/learn/appeals/${remarkBlocked.appealId}`}>
                See appeal {remarkBlocked.reference}
              </TextLink>{" "}
              or{" "}
              <TextLink href={`/learn/appeals/${scriptBlocked.appealId}`}>
                See appeal {scriptBlocked.reference}
              </TextLink>
              .
            </p>
          </Banner>
        ) : (
          <LodgeAppealForm
            facts={{
              resultId: options.result_id,
              itemTitle: options.item_title,
              resultText,
              versionNumber: options.assessed_version_number ?? null,
              learnerName: options.learner_name,
              coordinators,
              resubmitUntil,
              remarkBlocked,
              scriptBlocked,
            }}
          />
        )}
      </div>
    </div>
  );
}
