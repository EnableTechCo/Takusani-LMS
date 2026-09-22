import type { ReactNode } from "react";
import { formatDateTime, formatDateTimeSeconds } from "@/lib/dates";
import { cx } from "./cx";
import { Icon } from "./icons";
import { ReceiptActions } from "./receipt-actions";
import { Tag } from "./status";

/**
 * Records (design system 4.10). Append-only: nothing is edited, a new record is added and the earlier one stays.
 * References and times are monospace so they can be read out, compared and copied without error.
 */

/** An instant in South African time, for example "22 Sep 2026, 14:05". Say "(SAST)" once per sentence or column. */
export function DateTime({ iso, seconds, zone }: { iso: string; seconds?: boolean; zone?: boolean }) {
  return (
    <time className="datetime" dateTime={iso}>
      {seconds ? formatDateTimeSeconds(iso) : formatDateTime(iso)}
      {zone ? <span className="datetime__zone"> SAST</span> : null}
    </time>
  );
}

/** Proof that something was received: a reference to keep, the facts, and what happens next. Print keeps only this. */
export function Receipt({
  title,
  reference,
  rows,
  note,
}: {
  title: string;
  reference: string;
  rows: { label: string; value: ReactNode }[];
  note: ReactNode;
}) {
  return (
    <section aria-label={title} className="receipt">
      <p className="receipt__title">
        <Icon name="check-circle" />
        {title}
      </p>
      <code className="receipt__id">{reference}</code>
      <dl className="receipt__rows">
        {rows.map((row) => (
          <div className="receipt__row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="receipt__note">{note}</p>
      <ReceiptActions reference={reference} />
    </section>
  );
}

export interface HistoryEntry {
  id: string;
  /** "v2", or a sequence number. */
  badge: string;
  title: ReactNode;
  meta: ReactNode;
  current?: boolean;
  actions?: ReactNode;
}

/** Versions of a submission, or a chain of decisions, newest first. The current one is marked in words. */
export function HistoryList({ label, entries }: { label: string; entries: HistoryEntry[] }) {
  return (
    <ol aria-label={label} className="history-list">
      {entries.map((entry) => (
        <li className={cx("history-list__item", entry.current && "is-current")} key={entry.id}>
          <span className="history-list__badge">{entry.badge}</span>
          <span className="history-list__title">{entry.title}</span>
          <span className="history-list__meta">{entry.meta}</span>
          <span className="history-list__actions">
            {entry.current ? <Tag plain>Current</Tag> : null}
            {entry.actions}
          </span>
        </li>
      ))}
    </ol>
  );
}

export interface LogEntry {
  id: string;
  /** ISO instant. */
  at: string;
  actor: string;
  /** What happened, as a sentence after the actor's name. */
  event: ReactNode;
  /** Machine facts in monospace, for example an attempt id or a receipt. */
  detail?: ReactNode;
  /** An integrity event: marked with a caution bar. */
  marked?: boolean;
}

/** An append-only event log in time order. The label says the order and that times are SAST. */
export function Log({ label, entries, boxed }: { label: string; entries: LogEntry[]; boxed?: boolean }) {
  return (
    <ol aria-label={label} className={cx("log", boxed && "log--boxed")}>
      {entries.map((entry) => (
        <li className={cx("log__item", entry.marked && "log__item--marked")} key={entry.id}>
          <time className="log__time" dateTime={entry.at}>
            {formatDateTimeSeconds(entry.at)}
          </time>
          <div className="log__event">
            <span className="log__actor">{entry.actor}</span> {entry.event}
            {entry.detail ? <div className="log__detail">{entry.detail}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
