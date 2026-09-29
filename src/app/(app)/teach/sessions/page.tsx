import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listSessions } from "@/modules/learning/sessions-queries";
import { seriesLabel } from "@/modules/learning/series-rules";
import { durationText } from "@/modules/notifications/templates";

export const metadata = { title: "Sessions · Teaching" };

type Session = Awaited<ReturnType<typeof listSessions>>[number];

function SessionTable({ caption, sessions }: { caption: string; sessions: Session[] }) {
  return (
    <DataTable
      caption={caption}
      columns={[
        {
          key: "title",
          header: "Session",
          primary: true,
          cell: (session) => (
            <>
              <TextLink href={`/teach/sessions/${session.id}`}>{session.title}</TextLink>
              <span className="table__secondary">
                {session.cohort_name}
                {session.series_seq && session.series_count
                  ? ` · ${seriesLabel(session.series_seq, session.series_count)}`
                  : ""}
              </span>
            </>
          ),
        },
        { key: "when", header: "Starts (SAST)", cell: (session) => formatDateTime(session.starts_at) },
        { key: "length", header: "Length", cell: (session) => durationText(session.duration_minutes) },
        {
          key: "where",
          header: "Where",
          cell: (session) => (session.mode === "online" ? "Teams" : session.venue),
        },
        {
          key: "state",
          header: "State",
          cell: (session) =>
            session.state === "cancelled" ? <Tag tone="caution">Cancelled</Tag> : <Tag tone="info">Scheduled</Tag>,
        },
      ]}
      rowKey={(session) => session.id}
      rows={sessions}
    />
  );
}

// F-06 (FR-206, FR-207): the sessions of this person's cohorts. Upcoming first, soonest first; then those held.
export default async function TeachSessionsPage() {
  const sessions = await listSessions();
  const now = new Date();
  const ended = (session: Session) =>
    new Date(session.starts_at).getTime() + session.duration_minutes * 60_000 <= now.getTime();
  const upcoming = sessions.filter((session) => !ended(session));
  const past = sessions.filter(ended).reverse();

  return (
    <div className="page">
      <PageHeader
        actions={
          <ButtonLink href="/teach/sessions/new" variant="primary">
            Schedule a session
          </ButtonLink>
        }
        lead="Live sessions for your cohorts, online in Teams or in person. Times are SAST."
        title="Sessions"
        workspace="Teaching"
      />
      <div className="stack stack--lg">
        <section aria-labelledby="upcoming-h" className="stack">
          <h2 className="text-heading" id="upcoming-h">
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <div className="card">
              <EmptyState icon="video" title="No sessions coming up">
                <p>Schedule one: learners in the cohort are told, and it appears on their calendar.</p>
              </EmptyState>
            </div>
          ) : (
            <SessionTable caption="Upcoming sessions, soonest first. Times in SAST." sessions={upcoming} />
          )}
        </section>
        {past.length > 0 ? (
          <section aria-labelledby="past-h" className="stack">
            <h2 className="text-heading" id="past-h">
              Held
            </h2>
            <SessionTable caption="Sessions that have taken place, most recent first. Times in SAST." sessions={past} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
