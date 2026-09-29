import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/status";
import { Agenda, agendaItems } from "@/modules/learning/agenda";
import { MonthCalendar } from "@/modules/learning/month-calendar";
import { monthStart, parseMonth, sastDateOf, sastMonthOf } from "@/modules/learning/month";
import { listMySessions } from "@/modules/learning/sessions-queries";
import { listMyTasks } from "@/modules/submissions/queries";

export const metadata = { title: "Calendar" };

// L-07 (FR-304, FR-305, FR-207, FR-203): the learner's sessions and due dates, as a month grid for orientation and an
// agenda of what is coming up. The Teams link is on the agenda, so a learner joins from the calendar. Exams are
// deprecated and in the backlog. The phone-calendar feed is L-08.
export default async function LearnCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: asked } = await searchParams;
  const now = new Date();
  const month = parseMonth(asked) ?? sastMonthOf(now);
  const from = new Date(Math.min(monthStart(month).getTime(), now.getTime()));
  const [sessions, tasks] = await Promise.all([listMySessions(from), listMyTasks()]);

  // The grid shows the whole month, past days included; the agenda only what has not ended yet.
  const monthItems = agendaItems(sessions, tasks, monthStart(month));
  const upcoming = agendaItems(
    sessions.filter(
      (session) => new Date(session.starts_at).getTime() + session.duration_minutes * 60_000 > now.getTime(),
    ),
    tasks,
    now,
  );

  return (
    <div className="page">
      <PageHeader
        lead="Sessions and due dates. Times are South African time (SAST)."
        title="Calendar"
        workspace="Learning"
      />
      <div className="page-layout">
        <div className="page-layout__main">
          <MonthCalendar items={monthItems} month={month} today={sastDateOf(now.toISOString())} />
        </div>
        <section aria-labelledby="coming-up-h" className="card page-layout__aside">
          <div className="card__header">
            <h2 className="card__title" id="coming-up-h">
              Coming up
            </h2>
            <TextLink href="/learn/calendar/subscribe">Subscribe in your calendar app</TextLink>
          </div>
          <div className="card__body">
            {upcoming.length === 0 ? (
              <EmptyState icon="calendar" title="Nothing coming up">
                <p>Sessions and due dates for your cohort appear here, with the link to join each online session.</p>
              </EmptyState>
            ) : (
              <Agenda items={upcoming} label="Coming up" now={now} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
