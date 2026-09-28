import { TextLink } from "@/components/ui/link";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { EmptyState } from "@/components/ui/status";
import { formatDateTime, formatLongDayOf } from "@/lib/dates";
import { listMyResults } from "@/modules/assessment/queries";
import { requireActiveAccess } from "@/modules/identity/session";
import { Agenda, agendaItems } from "@/modules/learning/agenda";
import { getPublicSettings } from "@/modules/audit/settings";
import { BeingAssessedCard, DoNextTable, NewResultCard } from "@/modules/learning/home";
import {
  beingAssessed,
  doNext,
  firstName,
  greeting,
  newResults,
  summaryLine,
  type HomeResult,
  type HomeTask,
} from "@/modules/learning/home-rules";
import { listMySessions } from "@/modules/learning/sessions-queries";
import { notificationText } from "@/modules/notifications/centre-rules";
import { listMyNotifications } from "@/modules/notifications/queries";
import { listMyEnrolments } from "@/modules/programmes/queries";
import { listMyTasks } from "@/modules/submissions/queries";

export const metadata = { title: "Home" };

// L-01 (P0-03; FR-304, FR-305, FR-316, FR-317): what needs the learner now, in one screen: new results, do next,
// this week's sessions (S2-15) and being assessed. The exam window and credits join when those features ship.
export default async function LearnHomePage() {
  const [access, tasks, results, enrolments, sessions, noticeRows] = await Promise.all([
    requireActiveAccess(),
    listMyTasks() as Promise<HomeTask[]>,
    listMyResults() as Promise<HomeResult[]>,
    listMyEnrolments(),
    listMySessions(),
    listMyNotifications("notices", 1),
  ]);
  const now = new Date();
  const fresh = newResults(results, tasks, now);
  const todo = doNext(tasks, results, now);
  const assessed = beingAssessed(tasks, results);
  // Notices from coordinators in the last 14 days (S2-17), newest first, at most three.
  const fortnightAgo = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  const notices = noticeRows.filter((row) => new Date(row.created_at).getTime() >= fortnightAgo).slice(0, 3);
  // P0-03 block 3: sessions in the next seven days, with their Teams links.
  const weekAhead = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const comingUp = agendaItems(
    sessions.filter((session) => new Date(session.starts_at).getTime() < weekAhead),
    [],
    now,
  );
  const name = firstName(access.full_name);
  const firstDay = tasks.length === 0 && results.length === 0;
  const enrolment = enrolments[0];
  const programme = enrolment
    ? `${enrolment.programme_title}${enrolment.nqf_level ? `, NQF Level ${enrolment.nqf_level}` : ""}`
    : null;

  return (
    <>
      <OfflineBanner renderedAt={now.toISOString()} />
      <div className="page">
        <header className="page-header">
          <p className="text-overline">
            <time dateTime={now.toISOString()}>{formatLongDayOf(now.toISOString())}</time>
          </p>
          <h1 className="page-header__title">{firstDay ? `Welcome, ${name}` : `${greeting(now)}, ${name}`}</h1>
          <p className="page-header__lead">
            {firstDay
              ? enrolment
                ? `You are enrolled in ${programme} with ${enrolment.cohort_name}. Nothing is due yet. This page will always show what to do next.`
                : "Nothing is due yet. This page will always show what to do next."
              : summaryLine(fresh, todo)}
          </p>
          {enrolment && !firstDay ? (
            <div className="page-header__meta">
              <span>{programme}</span>
              {enrolments.map((row) => (
                <span key={row.cohort_id}>{row.cohort_name}</span>
              ))}
            </div>
          ) : null}
        </header>

        <div className="stack stack--lg">
          {fresh.length > 0 ? (
            <section aria-labelledby="new-results-h" className="stack">
              <div className="section__header">
                <h2 className="text-heading" id="new-results-h">
                  {fresh.length === 1 ? "New result" : "New results"}
                </h2>
                <TextLink href="/learn/results">All results</TextLink>
              </div>
              {fresh.map((item) => (
                <NewResultCard item={item} key={item.result.result_id} now={now} />
              ))}
            </section>
          ) : null}

          {notices.length > 0 ? (
            <section aria-labelledby="notices-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="notices-h">
                  Notices
                </h2>
                <TextLink href="/notifications?show=notices">All notices</TextLink>
              </div>
              <div className="card__body stack">
                {notices.map((row) => {
                  const { title, summary } = notificationText(
                    row.event_type,
                    row.template_version,
                    row.payload as Record<string, unknown>,
                  );
                  return (
                    <div key={row.id}>
                      <p className="text-subheading">
                        {row.read_at ? null : <span className="u-visually-hidden">Unread: </span>}
                        {/* A plain anchor: opening it marks the notice read. */}
                        <a className="link" href={`/notifications/${row.id}`}>
                          {title}
                        </a>
                      </p>
                      <p className="text-small text-muted">
                        {formatDateTime(row.created_at)}
                        {summary ? ` · ${summary}` : ""}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="do-next-h" className="stack">
            <div className="section__header">
              <h2 className="text-heading" id="do-next-h">
                Do next
              </h2>
              <TextLink href="/learn/tasks">All tasks</TextLink>
            </div>
            {todo.length > 0 ? (
              <DoNextTable items={todo} now={now} />
            ) : (
              <div className="card">
                <EmptyState icon="check-circle" title="Nothing to hand in right now">
                  <p>When new work is set for you, it appears here with its due date.</p>
                </EmptyState>
              </div>
            )}
          </section>

          {comingUp.length > 0 ? (
            <section aria-labelledby="coming-up-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="coming-up-h">
                  Sessions this week
                </h2>
                <TextLink href="/learn/calendar">Open your calendar</TextLink>
              </div>
              <div className="card__body">
                <Agenda items={comingUp} label="Sessions this week" now={now} />
              </div>
            </section>
          ) : null}

          {assessed.length > 0 ? (
            <BeingAssessedCard appealWindowDays={(await getPublicSettings()).appealWindowDays} items={assessed} />
          ) : null}
        </div>
      </div>
    </>
  );
}
