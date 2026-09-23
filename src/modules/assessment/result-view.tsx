import { ButtonLink, TextLink } from "@/components/ui/link";
import { DateTime } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { cx } from "@/components/ui/cx";
import { Icon } from "@/components/ui/icons";
import { formatDateTime, formatLongDayOf, formatTime, sastDaysFromToday } from "@/lib/dates";
import { formatBytes } from "@/modules/submissions/rules";
import { appealWindow, OUTCOME_LABELS, resubmission } from "./rules";

/**
 * The learner's result (L-15, P0-07). Server-rendered with no client islands. The database has already decided what
 * the learner may read: a held result arrives with no outcome, marks, feedback or dates, so nothing here can leak
 * them by mistake.
 */

export interface Mark {
  ordinal: number;
  title: string;
  max_points: number | null;
  points: number | null;
  comment: string | null;
}

export interface VersionFacts {
  version_number: number;
  submitted_at: string;
  is_late: boolean;
  receipt_reference: string;
  files?: number;
  bytes?: number;
}

/** A released result: the database returns every field below once, and only once, the result is released. */
export interface ReleasedResult {
  resultId: string;
  taskId: string;
  itemTitle: string;
  taskClosed: boolean;
  outcome: "competent" | "not_yet_competent";
  releasedAt: string;
  appealDeadlineAt: string;
  remediation: string | null;
  remediationDeadlineAt: string | null;
  feedback: string | null;
  assessorName: string | null;
  marks: Mark[];
  assessedVersion: VersionFacts;
  latestVersion: VersionFacts;
  firstViewedAt: string | null;
}

/** Text as the assessor wrote it: a blank line starts a paragraph, a single line break is kept. */
function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cx("prose", className)}>
      {text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
        .map((paragraph, index) => (
          <p className="whitespace-pre-line" key={index}>
            {paragraph}
          </p>
        ))}
    </div>
  );
}

function OutcomeTag({ outcome }: { outcome: ReleasedResult["outcome"] }) {
  // Not yet competent is caution, never critical: critical is for faults, not a learner's outcome (design system 3).
  return outcome === "competent" ? (
    <Tag large tone="positive">
      {OUTCOME_LABELS.competent}
    </Tag>
  ) : (
    <Tag large tone="caution">
      {OUTCOME_LABELS.not_yet_competent}
    </Tag>
  );
}

/** "7 of 8" where the rubric carries points; null when no criterion does. */
function markTotal(marks: Mark[]): { scored: number; possible: number } | null {
  const withPoints = marks.filter((mark) => mark.max_points !== null);
  if (withPoints.length === 0) return null;
  return {
    scored: withPoints.reduce((sum, mark) => sum + (mark.points ?? 0), 0),
    possible: withPoints.reduce((sum, mark) => sum + (mark.max_points ?? 0), 0),
  };
}

function daysLeftText(days: number): string {
  return days === 1 ? "1 day left" : `${days} days left`;
}

/**
 * The appeal clock, on the page and never behind a click (SRS 5.3). Written as the last full day, never a midnight
 * time (P-11). Until online appeals ship (S3-01), the learner is told to contact their coordinator.
 */
export function AppealLine({
  resultId,
  releasedAt,
  appealDeadlineAt,
  now,
}: {
  resultId: string;
  releasedAt: string;
  appealDeadlineAt: string;
  now: Date;
}) {
  const window = appealWindow(appealDeadlineAt, now);
  if (window.state === "closed") {
    return (
      <p className="deadline-line deadline-line--closed">
        <Icon name="lock" />
        <span>
          The time to appeal closed at the end of {window.lastDay}. You had 7 days from the day your result was
          released, {formatLongDayOf(releasedAt)}.
        </span>
      </p>
    );
  }
  return (
    <>
      <p className={window.state === "last_day" ? "deadline-line deadline-line--soon" : "deadline-line"}>
        <Icon name="clock" />
        <span>
          {window.state === "last_day" ? (
            <>
              <strong>Today is the last day to appeal.</strong> You can appeal this result{" "}
              <span className="deadline-line__date">until the end of today, {window.lastDay}</span>.
            </>
          ) : (
            <>
              You can appeal this result <span className="deadline-line__date">until the end of {window.lastDay}</span>.{" "}
              <span className="deadline-line__left">{daysLeftText(window.daysLeft)}</span>, including weekends and
              public holidays.
            </>
          )}{" "}
          To appeal, contact your coordinator.
        </span>
      </p>
      <p>
        <ButtonLink href={`/learn/results/${resultId}/appeal/new`} variant="secondary">
          Appeal this result
        </ButtonLink>
      </p>
    </>
  );
}

/** Not yet competent is never left without a next step (FR-317): what to do, and until when. */
function NextSteps({ result, now }: { result: ReleasedResult; now: Date }) {
  if (result.outcome !== "not_yet_competent" || !result.remediationDeadlineAt) return null;
  const deadline = result.remediationDeadlineAt;
  const state = resubmission({
    deadlineAt: deadline,
    taskClosed: result.taskClosed,
    assessedVersion: result.assessedVersion.version_number,
    latestVersion: result.latestVersion.version_number,
    now,
  });
  const until = (
    <strong>
      until {formatLongDayOf(deadline)} at {formatTime(deadline)} (SAST)
    </strong>
  );
  const daysLeft = sastDaysFromToday(deadline, now);

  return (
    <Banner
      actions={
        state === "open" ? (
          <ButtonLink href={`/learn/tasks/${result.taskId}/submit`} variant="primary">
            Start your resubmission
          </ButtonLink>
        ) : null
      }
      icon="refresh"
      role="note"
      title="Here is what to do next"
      tone="caution"
    >
      {state === "waiting" ? (
        <p>
          You handed in version {result.latestVersion.version_number} on{" "}
          {formatDateTime(result.latestVersion.submitted_at)} (SAST). It is being assessed, and you will be told when
          its result is ready. This result stands until then.
        </p>
      ) : state === "ended" ? (
        <p>
          The time to resubmit ended on {formatLongDayOf(deadline)} at {formatTime(deadline)} (SAST).
        </p>
      ) : (
        <p>
          Some criteria still need evidence. You can resubmit {until}.{" "}
          <span className="mono">{daysLeft <= 0 ? "Ends today" : daysLeftText(daysLeft)}</span>
          {state === "task_closed" ? (
            <> This task no longer takes new versions online, so ask your coordinator how to hand in your work.</>
          ) : null}
        </p>
      )}
      {result.remediation ? <Paragraphs className="u-mt-2" text={result.remediation} /> : null}
    </Banner>
  );
}

function Marks({ result }: { result: ReleasedResult }) {
  if (result.marks.length === 0) return null;
  const total = markTotal(result.marks);
  const outcome = OUTCOME_LABELS[result.outcome];
  return (
    <section aria-labelledby="marks-h" className="stack">
      <h2 className="text-subheading" id="marks-h">
        Marks for each criterion
      </h2>
      <DataTable
        caption={`Marks for each criterion of ${result.itemTitle}, with your assessor's comments`}
        columns={[
          { key: "criterion", header: "Criterion", primary: true, cell: (mark) => mark.title },
          {
            key: "mark",
            header: "Mark",
            numeric: true,
            cell: (mark) => (mark.max_points === null ? "Not scored" : `${mark.points ?? 0} of ${mark.max_points}`),
          },
          {
            key: "comment",
            header: "Assessor's comment",
            cell: (mark) => mark.comment ?? <span className="text-muted">No comment</span>,
          },
        ]}
        rowKey={(mark) => String(mark.ordinal)}
        rows={result.marks}
      />
      {/* Marks never appear without the outcome in words (P0-07). */}
      <p>
        <strong>
          {total ? `Total: ${total.scored} of ${total.possible}. ` : null}Outcome: {outcome}.
        </strong>
      </p>
    </section>
  );
}

/** "How you were told" (NFR-11): each channel in words, with its time. Email evidence arrives with S2-10. */
function HowYouWereTold({ result }: { result: ReleasedResult }) {
  return (
    <>
      <details className="delivery-evidence" open>
        <summary>How you were told</summary>
        <ul className="delivery-evidence__list">
          <li className="delivery-evidence__row">
            <span className="delivery-evidence__channel">Released in the LMS</span>
            <time className="delivery-evidence__time" dateTime={result.releasedAt}>
              {formatDateTime(result.releasedAt)}
            </time>
          </li>
          {result.firstViewedAt ? (
            <li className="delivery-evidence__row">
              <span className="delivery-evidence__channel">First opened by you</span>
              <time className="delivery-evidence__time" dateTime={result.firstViewedAt}>
                {formatDateTime(result.firstViewedAt)}
              </time>
            </li>
          ) : null}
        </ul>
      </details>
      <p className="text-small text-muted">
        Your 7 days to appeal are counted from the day your result was released: {formatLongDayOf(result.releasedAt)}.
        Times are South African time.
      </p>
    </>
  );
}

function AssessedWork({ result }: { result: ReleasedResult }) {
  const version = result.assessedVersion;
  return (
    <div className="card">
      <div className="card__header">
        <h2 className="card__title">The work that was assessed</h2>
      </div>
      <div className="card__body">
        <dl className="dl">
          <div className="dl__row">
            <dt>Version</dt>
            <dd>
              Version {version.version_number} {version.is_late ? <Tag tone="caution">Late</Tag> : null}
            </dd>
          </div>
          <div className="dl__row">
            <dt>Submitted</dt>
            <dd>
              <DateTime iso={version.submitted_at} zone />
            </dd>
          </div>
          <div className="dl__row">
            <dt>Receipt</dt>
            <dd className="mono">{version.receipt_reference}</dd>
          </div>
          {result.assessorName ? (
            <div className="dl__row">
              <dt>Assessor</dt>
              <dd>{result.assessorName}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="card__footer">
        <TextLink href={`/learn/tasks/${result.taskId}`}>Open the task and your versions</TextLink>
      </div>
    </div>
  );
}

export function ReleasedResultView({ result, now }: { result: ReleasedResult; now: Date }) {
  const total = markTotal(result.marks);
  return (
    <div className="page-layout">
      <div className="page-layout__main stack stack--lg">
        <article aria-labelledby="result-h" className="result">
          <div className="result__head">
            <div className="result__outcome">
              <p className="text-overline" id="result-h">
                {result.itemTitle}
              </p>
              <OutcomeTag outcome={result.outcome} />
            </div>
            {total ? (
              <div className="result__marks">
                <p className="text-figure">
                  {total.scored}
                  <span className="stat__unit"> of {total.possible}</span>
                </p>
                <p className="text-small text-muted">{OUTCOME_LABELS[result.outcome]}</p>
              </div>
            ) : null}
          </div>

          <div className="result__body">
            {/* First screenful, in order (P0-07): outcome, the appeal clock (SRS 5.3), then the next step (FR-317). */}
            <AppealLine
              appealDeadlineAt={result.appealDeadlineAt}
              now={now}
              releasedAt={result.releasedAt}
              resultId={result.resultId}
            />
            <NextSteps now={now} result={result} />
            <Marks result={result} />
            <section aria-labelledby="feedback-h" className="stack">
              <h2 className="text-subheading" id="feedback-h">
                {result.assessorName ? `Feedback from your assessor, ${result.assessorName}` : "Feedback"}
              </h2>
              {result.feedback ? (
                <Paragraphs text={result.feedback} />
              ) : (
                <p className="text-muted">Your assessor did not add overall feedback.</p>
              )}
            </section>
          </div>

          <div className="result__footer">
            Released on {formatLongDayOf(result.releasedAt)} at {formatTime(result.releasedAt)} (SAST).
          </div>
        </article>
      </div>

      <aside aria-label="How you were told, and the work that was assessed" className="page-layout__aside stack">
        <HowYouWereTold result={result} />
        <AssessedWork result={result} />
      </aside>
    </div>
  );
}

/** Still being assessed: no outcome, no marks, and no dates that hint at one (BR-04). */
export function HeldResultView({
  taskId,
  itemTitle,
  moderated,
  latestVersion,
}: {
  taskId: string;
  itemTitle: string;
  moderated: boolean;
  latestVersion: VersionFacts | null;
}) {
  return (
    <div className="page-layout">
      <div className="page-layout__main stack stack--lg">
        <article aria-labelledby="held-h" className="result">
          <div className="result__head">
            <div className="result__outcome">
              <p className="text-overline" id="held-h">
                {itemTitle}
              </p>
              <Tag large shape="half" tone="info">
                Being assessed
              </Tag>
            </div>
          </div>
          <div className="result__body">
            <Banner title="We have your work" tone="info">
              <p>
                {moderated
                  ? "In this programme, results are checked by a second person (a moderator) before anyone sees them, and everyone's results for the same task are released together."
                  : "Your assessor is marking your work."}{" "}
                You will be told here when your result is ready. Your 7 days to appeal, and any time you are given to
                resubmit, only start on the day your result is released.
              </p>
            </Banner>
            <div>
              <h2 className="text-subheading">What you can do now</h2>
              <ul className="prose u-mt-2">
                <li>Nothing is needed from you. There is no outcome, mark or feedback to see yet.</li>
                <li>You do not lose any time to appeal while you wait. That time has not started.</li>
                <li>
                  Carry on with <TextLink href="/learn/tasks">your other work</TextLink>.
                </li>
              </ul>
            </div>
          </div>
          {latestVersion ? (
            <div className="result__footer">
              Version {latestVersion.version_number} received on {formatLongDayOf(latestVersion.submitted_at)} at{" "}
              {formatTime(latestVersion.submitted_at)} (SAST). Receipt{" "}
              <span className="mono">{latestVersion.receipt_reference}</span>.
            </div>
          ) : null}
        </article>
      </div>
      {latestVersion ? (
        <aside aria-label="Your submission" className="page-layout__aside stack">
          <div className="card">
            <div className="card__header">
              <h2 className="card__title">Your submission</h2>
            </div>
            <div className="card__body">
              <dl className="dl">
                <div className="dl__row">
                  <dt>Version</dt>
                  <dd>
                    Version {latestVersion.version_number}{" "}
                    {latestVersion.is_late ? <Tag tone="caution">Late</Tag> : null}
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Files</dt>
                  <dd>
                    {latestVersion.files === 1 ? "1 file" : `${latestVersion.files ?? 0} files`},{" "}
                    {formatBytes(latestVersion.bytes ?? 0)}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="card__footer">
              <TextLink href={`/learn/tasks/${taskId}`}>Open the task and your receipt</TextLink>
            </div>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
