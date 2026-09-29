import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Meter, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatTime } from "@/lib/dates";
import { CheckInButton } from "@/modules/learning/attendance-forms";
import { listMyAttendance } from "@/modules/learning/attendance-queries";
import { attendanceRate, attendanceText, learnerAttendanceStatus } from "@/modules/learning/attendance-rules";
import { durationText } from "@/modules/notifications/templates";

export const metadata = { title: "Attendance" };

// L-20 (FR-209): the learner's own attendance: every session that has started, latest first, with their check-in
// and the mark the facilitator confirmed, and their rate across the confirmed registers.
export default async function LearnAttendancePage() {
  const rows = await listMyAttendance();
  const rate = attendanceRate(rows);
  const onNow = rows.filter((row) => row.checkin_state === "open");

  return (
    <div className="page">
      <PageHeader
        lead="Mark yourself present while a session is on. Your facilitator confirms the register; only confirmed registers count. Times are SAST."
        title="Attendance"
        workspace="Learning"
      />
      <div className="stack stack--lg">
        <section aria-labelledby="rate-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="rate-h">
              Your attendance so far
            </h2>
          </div>
          <div className="card__body stack">
            <p>{attendanceText(rate)}</p>
            {rate.percent !== null ? (
              <Meter
                caution={rate.percent < 50}
                label="Sessions you were present at"
                max={rate.sessions}
                value={rate.present}
                valueText={`${rate.present} of ${rate.sessions}`}
              />
            ) : null}
            {onNow.length > 0 ? (
              <div className="stack stack--sm">
                {onNow.map((row) => (
                  <div className="cluster cluster--between" key={row.session_id}>
                    <span>
                      <strong>{row.title}</strong> is on now.
                    </span>
                    <CheckInButton
                      checkedInAt={row.checked_in_at}
                      sessionId={row.session_id}
                      sessionTitle={row.title}
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {rows.length === 0 ? (
          <div className="card">
            <EmptyState icon="calendar" title="No sessions yet">
              <p>Each session appears here once it starts. Find the next one on your calendar.</p>
            </EmptyState>
          </div>
        ) : (
          <DataTable
            caption="Your sessions, latest first, each with your check-in and the confirmed mark. Times in SAST."
            columns={[
              {
                key: "session",
                header: "Session",
                primary: true,
                cell: (row) => (
                  <>
                    <span className="table__primary">{row.title}</span>
                    <span className="table__secondary">
                      {row.cohort_name} · {row.mode === "online" ? "Teams" : row.venue}
                    </span>
                  </>
                ),
              },
              {
                key: "when",
                header: "When (SAST)",
                cell: (row) => (
                  <>
                    {formatDateTime(row.starts_at)}
                    <span className="table__secondary">{durationText(row.duration_minutes)}</span>
                  </>
                ),
              },
              {
                key: "checkin",
                header: "Your check-in",
                cell: (row) =>
                  row.checked_in_at
                    ? `Checked in ${formatTime(row.checked_in_at)}`
                    : row.attendance
                      ? "None"
                      : "Not checked in",
              },
              {
                key: "status",
                header: "Status",
                cell: (row) => {
                  const status = learnerAttendanceStatus(row);
                  return (
                    <>
                      <Tag shape={status.tone === "positive" ? "check" : undefined} tone={status.tone}>
                        {status.label}
                      </Tag>
                      {row.confirmed_at ? (
                        <span className="table__secondary">Confirmed {formatDateTime(row.confirmed_at)}</span>
                      ) : null}
                    </>
                  );
                },
              },
            ]}
            rowKey={(row) => row.session_id}
            rows={rows}
          />
        )}
        <p>
          <TextLink href="/learn/calendar">Your calendar</TextLink>
        </p>
      </div>
    </div>
  );
}
