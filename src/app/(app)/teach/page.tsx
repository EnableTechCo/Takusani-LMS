import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { registersToConfirm, sessionAttendanceText, sessionRegisterTag } from "@/modules/learning/attendance-rules";
import { listSessions } from "@/modules/learning/sessions-queries";
import { joinWindow } from "@/modules/learning/sessions-rules";
import {
  outstandingWork,
  sessionsComingUp,
  sessionsToday,
  teachLead,
  workSummary,
  type OutstandingTask,
  type OverviewSession,
} from "@/modules/learning/teach-overview-rules";
import { durationText } from "@/modules/notifications/templates";
import { listTaskSubmissionCounts } from "@/modules/submissions/dashboard-queries";
import { listWorkCohorts } from "@/modules/submissions/queries";

export const metadata = { title: "Overview · Teaching" };

function SessionRows({ caption, sessions, now }: { caption: string; sessions: OverviewSession[]; now: Date }) {
  return (
    <DataTable
      caption={caption}
      columns={[
        {
          key: "session",
          header: "Session",
          primary: true,
          cell: (session) => (
            <>
              <TextLink href={`/teach/sessions/${session.id}`}>{session.title}</TextLink>
              <span className="table__secondary">{session.cohort_name}</span>
            </>
          ),
        },
        {
          key: "when",
          header: "When (SAST)",
          cell: (session) => (
            <>
              {formatDateTime(session.starts_at)}
              <span className="table__secondary">{durationText(session.duration_minutes)}</span>
            </>
          ),
        },
        {
          key: "where",
          header: "Where",
          cell: (session) => (session.mode === "online" ? "Teams" : (session.venue ?? "In person")),
        },
        {
          key: "audience",
          header: "Attendance",
          cell: (session) => {
            const tag = sessionRegisterTag(session);
            return (
              <>
                {session.checkin_state === "not_open" ? `${session.audience} learners` : sessionAttendanceText(session)}
                {tag ? (
                  <span className="table__secondary">
                    <Tag tone={tag.tone}>{tag.label}</Tag>
                  </span>
                ) : null}
              </>
            );
          },
        },
        {
          key: "actions",
          header: "Actions",
          actions: true,
          cell: (session) => {
            const window = joinWindow(session.starts_at, session.duration_minutes, now);
            if (session.mode === "online" && session.teams_url && window.state === "open") {
              return (
                <ButtonLink href={session.teams_url} size="sm" variant="primary">
                  Join
                  <span className="u-visually-hidden"> {session.title} in Teams</span>
                </ButtonLink>
              );
            }
            const started = new Date(session.starts_at).getTime() <= now.getTime();
            return (
              <ButtonLink
                href={`/teach/sessions/${session.id}/register`}
                size="sm"
                variant={started && session.register_version === 0 ? "primary" : "secondary"}
              >
                {session.register_version > 0 ? "Register" : started ? "Confirm register" : "Register"}
                <span className="u-visually-hidden"> for {session.title}</span>
              </ButtonLink>
            );
          },
        },
      ]}
      rowKey={(session) => session.id}
      rows={sessions}
    />
  );
}

function OutstandingRows({ tasks }: { tasks: OutstandingTask[] }) {
  return (
    <DataTable
      caption="Assignments with work outstanding: past due first, then the soonest due. Times in SAST."
      columns={[
        {
          key: "task",
          header: "Assignment",
          primary: true,
          cell: (task) => (
            <>
              <TextLink href={`/teach/submissions?cohort=${task.cohort_id}&task=${task.task_id}`}>
                {task.title}
              </TextLink>
              <span className="table__secondary">{task.cohort_name}</span>
            </>
          ),
        },
        {
          key: "due",
          header: "Due (SAST)",
          cell: (task) =>
            task.due_at === null ? (
              "No due time"
            ) : task.overdue ? (
              <Tag tone="caution">Past due: {formatDateTime(task.due_at)}</Tag>
            ) : (
              formatDateTime(task.due_at)
            ),
        },
        {
          key: "submitted",
          header: "Handed in",
          numeric: true,
          cell: (task) => `${task.submitted} of ${task.audience}`,
        },
        { key: "outstanding", header: "Outstanding", numeric: true, cell: (task) => task.outstanding },
        { key: "late", header: "Late", numeric: true, cell: (task) => task.late },
      ]}
      rowKey={(task) => `${task.cohort_id}:${task.task_id}`}
      rows={tasks}
    />
  );
}

// F-01 (FR-210, FR-209): what needs the facilitator now. Today's sessions with Join and the check-ins so far, the
// registers still to confirm, the week ahead, and every task with work still outstanding. The landing page for a
// facilitator.
export default async function TeachOverviewPage() {
  const [sessions, cohorts] = await Promise.all([listSessions(), listWorkCohorts()]);
  const counts = await Promise.all(
    cohorts.map(async (cohort) =>
      (await listTaskSubmissionCounts(cohort.id)).map((row) => ({
        ...row,
        cohort_id: cohort.id,
        cohort_name: cohort.name,
      })),
    ),
  );
  const now = new Date();
  const today = sessionsToday(sessions, now);
  const comingUp = sessionsComingUp(sessions, now);
  const registers = registersToConfirm(sessions, now);
  const tasks = outstandingWork(counts.flat(), now);
  const summary = workSummary(tasks);

  return (
    <div className="page">
      <PageHeader lead={teachLead(today.length, tasks, registers.length)} title="Overview" workspace="Teaching" />
      <div className="stack stack--lg">
        <div className="grid grid--4" role="list">
          <div className="stat" role="listitem">
            <span className="stat__label">Sessions today</span>
            <span className="stat__value">{today.length}</span>
            <span className="stat__meta">
              {comingUp.length === 0 ? "None more this week" : `${comingUp.length} more this week`}
            </span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Registers to confirm</span>
            <span className="stat__value">{registers.length}</span>
            <span className="stat__meta">
              {registers.length === 0 ? (
                "Every started session is confirmed"
              ) : (
                <TextLink href="/teach/attendance">Attendance by cohort</TextLink>
              )}
            </span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Assignments with work outstanding</span>
            <span className="stat__value">{summary.tasks}</span>
            <span className="stat__meta">{tasks.filter((task) => task.overdue).length} past due</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Learners still to hand in</span>
            <span className="stat__value">{summary.outstanding}</span>
            <span className="stat__meta">Across those assignments</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Late submissions</span>
            <span className="stat__value">{summary.late}</span>
            <span className="stat__meta">Handed in after the due time</span>
          </div>
        </div>

        <section aria-labelledby="today-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="today-h">
              Today
            </h2>
            <TextLink href="/teach/sessions">All sessions</TextLink>
          </div>
          {today.length === 0 ? (
            <div className="card">
              <EmptyState icon="video" title="No sessions today">
                <p>
                  {comingUp.length === 0
                    ? "Nothing is scheduled this week either."
                    : `The next one is ${formatDateTime(comingUp[0].starts_at)} (SAST).`}
                </p>
              </EmptyState>
            </div>
          ) : (
            <SessionRows caption="Today's sessions, earliest first. Times in SAST." now={now} sessions={today} />
          )}
        </section>

        {registers.length > 0 ? (
          <section aria-labelledby="registers-h" className="stack">
            <div className="section__header">
              <h2 className="text-heading" id="registers-h">
                Registers to confirm
              </h2>
              <TextLink href="/teach/attendance">Attendance by cohort</TextLink>
            </div>
            <DataTable
              caption="Sessions that have started and whose register is not confirmed, latest first. Times in SAST."
              columns={[
                {
                  key: "session",
                  header: "Session",
                  primary: true,
                  cell: (session) => (
                    <>
                      <TextLink href={`/teach/sessions/${session.id}`}>{session.title}</TextLink>
                      <span className="table__secondary">{session.cohort_name}</span>
                    </>
                  ),
                },
                { key: "when", header: "Started (SAST)", cell: (session) => formatDateTime(session.starts_at) },
                { key: "checkins", header: "Checked in", cell: (session) => sessionAttendanceText(session) },
                {
                  key: "confirm",
                  header: "Actions",
                  actions: true,
                  cell: (session) => (
                    <ButtonLink href={`/teach/sessions/${session.id}/register`} size="sm" variant="primary">
                      Confirm register<span className="u-visually-hidden"> for {session.title}</span>
                    </ButtonLink>
                  ),
                },
              ]}
              rowKey={(session) => session.id}
              rows={registers}
            />
          </section>
        ) : null}

        {comingUp.length > 0 ? (
          <section aria-labelledby="week-h" className="stack">
            <h2 className="text-heading" id="week-h">
              Coming up this week
            </h2>
            <SessionRows
              caption="Sessions in the next seven days, soonest first. Times in SAST."
              now={now}
              sessions={comingUp}
            />
          </section>
        ) : null}

        <section aria-labelledby="outstanding-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="outstanding-h">
              Outstanding work
            </h2>
            <TextLink href="/teach/submissions">Submissions</TextLink>
          </div>
          {tasks.length === 0 ? (
            <div className="card">
              <EmptyState icon="check-circle" title="Everything set has been handed in">
                <p>When a published assignment still has learners to hand in, it appears here with the counts.</p>
              </EmptyState>
            </div>
          ) : (
            <OutstandingRows tasks={tasks} />
          )}
        </section>
      </div>
    </div>
  );
}
