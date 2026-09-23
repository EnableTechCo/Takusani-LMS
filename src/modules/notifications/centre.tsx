import { Icon, type IconName } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/dates";
import { emailLine, groupByDay, notificationText, type EmailEvidence } from "./centre-rules";

/**
 * The notification list (G-05, P0-02). Server-rendered: each row opens through /notifications/[id], which marks it
 * read, and "How you were told" is a native disclosure. Every row is also the record of when and how the person was
 * told (NFR-11).
 */

export interface NotificationRow {
  id: string;
  event_type: string;
  template_version: number;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
  email: EmailEvidence | null;
  first_opened_at: string | null;
}

const ICONS: Record<string, IconName> = {
  result_released: "check-circle",
  task_published: "clipboard",
};

function Evidence({ row, title }: { row: NotificationRow; title: string }) {
  const email = row.email ? emailLine(row.email) : null;
  return (
    <details className="delivery-evidence notification__extra">
      {/* A11Y-18: every row has this disclosure, so each one names what it is about. */}
      <summary>
        How you were told<span className="u-visually-hidden"> about: {title}</span>
      </summary>
      <ul className="delivery-evidence__list">
        <li className="delivery-evidence__row">
          <span className="delivery-evidence__channel">In the LMS</span>
          <time className="delivery-evidence__time" dateTime={row.created_at}>
            {formatDateTime(row.created_at)}
          </time>
        </li>
        {email ? (
          <li
            className={
              email.failed ? "delivery-evidence__row delivery-evidence__row--failed" : "delivery-evidence__row"
            }
          >
            <span className="delivery-evidence__channel">{email.text}</span>
            {email.at ? (
              <time className="delivery-evidence__time" dateTime={email.at}>
                {formatDateTime(email.at)}
              </time>
            ) : null}
          </li>
        ) : null}
        {row.event_type === "result_released" ? (
          <li className="delivery-evidence__row">
            <span className="delivery-evidence__channel">
              {row.first_opened_at ? "First opened by you" : "Not opened by you yet"}
            </span>
            {row.first_opened_at ? (
              <time className="delivery-evidence__time" dateTime={row.first_opened_at}>
                {formatDateTime(row.first_opened_at)}
              </time>
            ) : null}
          </li>
        ) : null}
      </ul>
    </details>
  );
}

function Row({ row }: { row: NotificationRow }) {
  const { title, summary } = notificationText(row.event_type, row.template_version, row.payload);
  const unread = row.read_at === null;
  return (
    <li className={unread ? "notification is-unread" : "notification"}>
      <span className="notification__icon">
        <Icon name={ICONS[row.event_type] ?? "bell"} />
      </span>
      <span className="notification__title">
        {unread ? <span className="u-visually-hidden">Unread: </span> : null}
        {/* A plain anchor, not a prefetching link: following it marks the notification read. */}
        <a href={`/notifications/${row.id}`}>{title}</a>
      </span>
      <time className="notification__time" dateTime={row.created_at}>
        {formatDateTime(row.created_at)}
      </time>
      {summary ? <span className="notification__body">{summary}</span> : null}
      {unread ? <span aria-hidden="true" className="notification__unread" /> : null}
      <Evidence row={row} title={title} />
    </li>
  );
}

export function NotificationList({ rows, now }: { rows: NotificationRow[]; now: Date }) {
  return (
    <>
      {groupByDay(rows, now).map((group, index) => (
        <section aria-labelledby={`day-${index}`} key={group.key}>
          <h2 className="text-subheading u-mb-4" id={`day-${index}`}>
            {group.heading}
          </h2>
          <ul aria-label={`Notifications from ${group.heading}`} className="notification-list">
            {group.items.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
