import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listSessionLogistics } from "@/modules/learning/logistics-queries";
import { arrangedText, varianceText } from "@/modules/learning/logistics-rules";

export const metadata = { title: "Logistics · Coordinating" };

// C-11 (FR-705 to FR-707): in-person sessions in your cohorts, from the last 30 days on, with what is arranged and
// any headcount difference to reconcile first.
export default async function CoordinateLogisticsPage() {
  const sessions = await listSessionLogistics();
  const flagged = sessions.filter((session) => session.variance_flagged).length;

  return (
    <div className="page">
      <PageHeader
        lead="In-person sessions in your cohorts: the venue, catering and equipment, and how attendance compared with the headcount. Times are SAST."
        meta={
          flagged > 0 ? (
            <Tag tone="caution">
              {flagged === 1 ? "1 difference to reconcile" : `${flagged} differences to reconcile`}
            </Tag>
          ) : undefined
        }
        title="Logistics"
        workspace="Coordinating"
      />
      {sessions.length === 0 ? (
        <div className="card">
          <EmptyState icon="calendar" title="No in-person sessions">
            <p>
              When a facilitator schedules a session in person, its venue, catering and equipment are arranged here.
            </p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="In-person sessions: differences to reconcile first, then by date. Times in SAST."
          columns={[
            {
              key: "session",
              header: "Session",
              primary: true,
              cell: (session) => (
                <>
                  <TextLink href={`/coordinate/sessions/${session.session_id}/logistics`}>{session.title}</TextLink>
                  <span className="table__secondary">{session.cohort_name}</span>
                </>
              ),
            },
            {
              key: "when",
              header: "When and where",
              cell: (session) => (
                <>
                  {formatDateTime(session.starts_at)}
                  <span className="table__secondary">{session.venue}</span>
                </>
              ),
            },
            {
              key: "arranged",
              header: "Arranged",
              cell: (session) => {
                if (session.session_state === "cancelled") return <Tag plain>Cancelled</Tag>;
                const arranged = arrangedText(session.arranged, session.needed);
                return arranged.all ? (
                  <Tag tone="positive">{arranged.text}</Tag>
                ) : (
                  <Tag shape="half" tone="info">
                    {arranged.text}
                  </Tag>
                );
              },
            },
            {
              key: "catering",
              header: "Catering",
              cell: (session) => (session.catering_needed ? `${session.headcount} people` : "None"),
            },
            {
              key: "attendance",
              header: "Attendance",
              cell: (session) =>
                !session.register_captured ? (
                  "Register not captured"
                ) : session.variance_flagged && session.headcount !== null && session.present !== null ? (
                  <Tag tone="caution">{varianceText(session.present, session.headcount)}</Tag>
                ) : session.present !== null && session.catering_needed && session.headcount !== null ? (
                  varianceText(session.present, session.headcount)
                ) : (
                  "Register captured"
                ),
            },
          ]}
          rowKey={(session) => session.session_id}
          rows={sessions}
        />
      )}
    </div>
  );
}
