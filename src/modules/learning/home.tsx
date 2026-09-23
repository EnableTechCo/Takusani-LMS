import { ButtonLink, TextLink } from "@/components/ui/link";
import { Icon } from "@/components/ui/icons";
import { Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatLongDayOf, formatTime, sastDaysFromToday } from "@/lib/dates";
import { appealWindow, OUTCOME_LABELS } from "@/modules/assessment/rules";
import type { AssessedItem, DoNextItem, NewResult } from "./home-rules";

/**
 * The blocks of learner home (L-01, P0-03), server-rendered. The rules that decide what goes in each block live in
 * home-rules.ts; these only lay it out, following prototype/learn-home.html.
 */

function daysText(days: number): string {
  if (days <= 0) return "today";
  return days === 1 ? "tomorrow" : `in ${days} days`;
}

/** P0-03 block 1: a released result while its appeal window or resubmission period is open. */
export function NewResultCard({ item, now }: { item: NewResult; now: Date }) {
  const { result } = item;
  const window = appealWindow(result.appeal_deadline_at!, now);
  const outcome = result.outcome === "competent" ? "competent" : "not_yet_competent";
  return (
    <article aria-labelledby={`new-${result.result_id}`} className="result">
      <div className="result__head">
        <div className="result__outcome">
          <p className="text-overline" id={`new-${result.result_id}`}>
            {result.item_title}
          </p>
          <Tag large tone={outcome === "competent" ? "positive" : "caution"}>
            {OUTCOME_LABELS[outcome]}
          </Tag>
        </div>
        <p className="text-small text-muted">
          Released <time dateTime={result.released_at!}>{formatDateTime(result.released_at!)}</time>
        </p>
      </div>
      <div className="result__body">
        {item.resubmitUntil ? (
          <p>
            Some criteria still need evidence. Your assessor has written down what to add.{" "}
            <strong>
              You can resubmit until {formatLongDayOf(item.resubmitUntil)} at {formatTime(item.resubmitUntil)} (SAST).
            </strong>
          </p>
        ) : null}
        {window.state === "closed" ? null : (
          <p className={window.state === "last_day" ? "deadline-line deadline-line--soon" : "deadline-line"}>
            <Icon name="clock" />
            <span>
              {window.state === "last_day" ? (
                <>
                  <strong>Today is the last day to appeal this result.</strong> To appeal, contact your coordinator.
                </>
              ) : (
                <>
                  You can appeal this result{" "}
                  <span className="deadline-line__date">until the end of {window.lastDay}</span>.{" "}
                  <span className="deadline-line__left">
                    {window.daysLeft === 1 ? "1 day left" : `${window.daysLeft} days left`}
                  </span>
                  , including weekends and public holidays.
                </>
              )}
            </span>
          </p>
        )}
        <div className="cluster">
          <ButtonLink href={`/learn/results/${result.result_id}`} variant="primary">
            View your result and feedback
          </ButtonLink>
          {item.resubmitUntil ? (
            <ButtonLink href={`/learn/tasks/${result.task_id}/submit`} variant="secondary">
              Start your resubmission
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </article>
  );
}

const STATUS: Record<DoNextItem["status"], { label: string; tone: "neutral" | "caution" }> = {
  not_started: { label: "Not started", tone: "neutral" },
  overdue: { label: "Overdue, still accepted", tone: "caution" },
  resubmission_open: { label: "Resubmission open", tone: "caution" },
};

function Deadline({ item, now }: { item: DoNextItem; now: Date }) {
  if (!item.deadline) return <span className="text-muted">No due date</span>;
  const when = `${formatDateTime(item.deadline)}`;
  if (item.status === "resubmission_open") {
    return (
      <span className="deadline">
        <Icon className="icon icon--sm" name="clock" />
        Resubmit by {when} · {daysText(sastDaysFromToday(item.deadline, now))}
      </span>
    );
  }
  const days = sastDaysFromToday(item.deadline, now);
  return (
    <span className={item.status === "overdue" ? "deadline deadline--soon" : "deadline"}>
      <Icon className="icon icon--sm" name="clock" />
      {item.status === "overdue" ? `Was due ${when}` : `Due ${when} · ${daysText(days)}`}
    </span>
  );
}

/** P0-03 block 2: work to do next, overdue first. */
export function DoNextTable({ items, now }: { items: DoNextItem[]; now: Date }) {
  return (
    <DataTable
      caption="Work to do next, overdue first, then soonest. Times are South African time."
      columns={[
        {
          key: "work",
          header: "Work",
          primary: true,
          cell: (item) => (
            <>
              <span className="table__primary">{item.title}</span>
              <span className="table__secondary">{item.cohortName}</span>
            </>
          ),
        },
        {
          key: "status",
          header: "Status",
          cell: (item) => <Tag tone={STATUS[item.status].tone}>{STATUS[item.status].label}</Tag>,
        },
        { key: "deadline", header: "Deadline (SAST)", cell: (item) => <Deadline item={item} now={now} /> },
        {
          key: "open",
          header: "Open",
          actions: true,
          cell: (item) => (
            <ButtonLink href={item.href} variant="secondary">
              Open<span className="u-visually-hidden"> {item.title}</span>
            </ButtonLink>
          ),
        },
      ]}
      rowKey={(item) => `${item.status}-${item.taskId}`}
      rows={items}
    />
  );
}

/** P0-03 block 4: work handed in with no result yet. No outcome, and no date that hints at one. */
export function BeingAssessedCard({ items }: { items: AssessedItem[] }) {
  return (
    <section aria-labelledby="assessed-h" className="card">
      <div className="card__header">
        <h2 className="card__title" id="assessed-h">
          Being assessed
        </h2>
        <TextLink href="/learn/results">All results</TextLink>
      </div>
      <div className="card__body stack">
        {items.map((item) => (
          <div className="cluster cluster--between" key={item.resultId}>
            <div>
              <p className="text-subheading">
                <TextLink href={`/learn/results/${item.resultId}`}>{item.title}</TextLink>
              </p>
              {item.version && item.submittedAt ? (
                <p className="text-small text-muted">
                  Version {item.version} handed in on{" "}
                  <time dateTime={item.submittedAt}>{formatDateTime(item.submittedAt)}</time>
                </p>
              ) : null}
            </div>
            <Tag shape="half" tone="info">
              Being assessed
            </Tag>
          </div>
        ))}
        <p className="text-small text-muted">
          You will be told here when a result is ready. Your 7 days to appeal, and any time you are given to resubmit,
          only start on the day a result is released.
        </p>
      </div>
    </section>
  );
}
