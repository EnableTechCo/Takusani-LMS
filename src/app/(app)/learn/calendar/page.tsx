import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/status";
import { Agenda, agendaItems } from "@/modules/learning/agenda";
import { listMySessions } from "@/modules/learning/sessions-queries";
import { listMyTasks } from "@/modules/submissions/queries";

export const metadata = { title: "Calendar" };

// L-07 (FR-305, FR-207, FR-203): the learner's sessions and due dates, as an agenda. The Teams link is here, so a
// learner joins from the calendar. The month view and the phone-calendar feed (FR-304) come later.
export default async function LearnCalendarPage() {
  const [sessions, tasks] = await Promise.all([listMySessions(), listMyTasks()]);
  const now = new Date();
  const items = agendaItems(sessions, tasks, now);

  return (
    <div className="page">
      <PageHeader
        lead="Sessions and due dates, soonest first. Times are South African time (SAST)."
        title="Calendar"
        workspace="Learning"
      />
      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon="calendar" title="Nothing coming up">
            <p>Sessions and due dates for your cohort appear here, with the link to join each online session.</p>
          </EmptyState>
        </div>
      ) : (
        <div className="card">
          <div className="card__body">
            <Agenda items={items} label="Coming up" now={now} />
          </div>
        </div>
      )}
    </div>
  );
}
