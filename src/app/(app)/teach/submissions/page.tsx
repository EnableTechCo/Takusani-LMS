import { PageHeader } from "@/components/shell/page-header";
import { buttonClass, iconClass } from "@/components/ui/button-class";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatLongDayOf, formatTime } from "@/lib/dates";
import { listTaskSubmissionCounts, listTaskSubmissions } from "@/modules/submissions/dashboard-queries";
import {
  countByStatus,
  defaultTaskId,
  filterRows,
  parseStatusFilter,
  STATUS_FILTER_LABELS,
  STATUS_FILTERS,
} from "@/modules/submissions/dashboard-rules";
import { SubmissionTable } from "@/modules/submissions/dashboard-table";
import { listWorkCohorts } from "@/modules/submissions/queries";

export const metadata = { title: "Submissions · Teaching" };

// F-08 (P0-10; FR-210, FR-211, FR-212): who has handed in, who has not, and who was late. Filters are GET parameters,
// so any view can be shared or bookmarked; selection and the reminder are the only client part.
export default async function SubmissionsDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string; task?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const cohorts = await listWorkCohorts();
  const cohort = cohorts.find((row) => row.id === params.cohort) ?? cohorts[0];

  if (!cohort) {
    return (
      <div className="page">
        <PageHeader title="Submissions" workspace="Teaching" />
        <div className="card">
          <EmptyState icon="clipboard" title="No cohorts to show">
            <p>Submissions appear here for the cohorts you set work in.</p>
          </EmptyState>
        </div>
      </div>
    );
  }

  const now = new Date();
  const tasks = await listTaskSubmissionCounts(cohort.id);
  const taskId = tasks.some((task) => task.task_id === params.task) ? params.task! : defaultTaskId(tasks, now);
  const task = tasks.find((row) => row.task_id === taskId) ?? null;
  const all = task ? await listTaskSubmissions(task.task_id) : [];
  const status = parseStatusFilter(params.status);
  const search = (params.q ?? "").trim().slice(0, 100);
  const rows = filterRows(all, status, search);
  const counts = countByStatus(all);

  const query = (change: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { cohort: cohort.id, task: taskId ?? undefined, status, q: search || undefined, ...change };
    for (const [key, value] of Object.entries(merged)) if (value && value !== "all") next.set(key, value);
    return next.toString();
  };

  return (
    <div className="page">
      <PageHeader
        actions={
          task ? (
            // A plain anchor: the export is a file, not a page for the router to navigate to.
            <a
              className={buttonClass({ variant: "secondary" })}
              download
              href={`/teach/submissions/export.csv?${query({})}`}
            >
              <Icon className={iconClass()} name="download" />
              Export CSV
            </a>
          ) : null
        }
        lead="Who has handed in, who has not, and who was late. You see submission status only: outcomes and marks are not shown here."
        meta={<span>As at {formatDateTime(now.toISOString())} SAST</span>}
        title="Submissions"
        workspace="Teaching"
      />

      <div className="stack stack--lg">
        {cohorts.length > 1 ? (
          <form action="/teach/submissions" className="cluster" method="get">
            <label className="field__label" htmlFor="cohort-select">
              Cohort
            </label>
            <span className="select">
              <select defaultValue={cohort.id} id="cohort-select" name="cohort">
                {cohorts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}, {row.programme_title}
                  </option>
                ))}
              </select>
            </span>
            <Button type="submit" variant="secondary">
              Show
            </Button>
          </form>
        ) : null}

        <section aria-labelledby="by-task-h" className="stack">
          <h2 className="text-heading" id="by-task-h">
            By assignment
          </h2>
          <p className="text-small text-muted">Submitted means on time. Late work is counted separately.</p>
          {tasks.length === 0 ? (
            <div className="card">
              <EmptyState icon="clipboard" title="No published assignments">
                <p>When you publish a task for {cohort.name}, who has handed it in shows here.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption={`Submission counts for each assignment in ${cohort.name}`}
              columns={[
                {
                  key: "task",
                  header: "Assignment",
                  primary: true,
                  cell: (row) =>
                    row.task_id === taskId ? (
                      <>
                        {row.title}
                        <span className="table__secondary">Shown below</span>
                      </>
                    ) : (
                      <TextLink
                        href={`/teach/submissions?${query({ task: row.task_id, status: undefined, q: undefined })}`}
                      >
                        {row.title}
                      </TextLink>
                    ),
                },
                {
                  key: "due",
                  header: "Due (SAST)",
                  cell: (row) => (row.due_at ? formatDateTime(row.due_at) : "No date"),
                },
                { key: "submitted", header: "Submitted", numeric: true, cell: (row) => row.submitted },
                { key: "late", header: "Late", numeric: true, cell: (row) => row.late },
                { key: "outstanding", header: "Outstanding", numeric: true, cell: (row) => row.outstanding },
              ]}
              rowKey={(row) => row.task_id}
              rows={tasks}
            />
          )}
        </section>

        {task ? (
          <section aria-labelledby="learners-h" className="stack">
            <h2 className="text-heading" id="learners-h">
              {task.title}
            </h2>
            <p className="text-small">
              {task.due_at
                ? `Due ${formatLongDayOf(task.due_at)} at ${formatTime(task.due_at)} (SAST). ${
                    task.late_policy === "closed_at_due"
                      ? "It closed at the due time."
                      : "Late work is still accepted and is marked as late."
                  }`
                : "No due date."}
            </p>

            <form action="/teach/submissions" className="cluster" method="get" role="search">
              <input name="cohort" type="hidden" value={cohort.id} />
              <input name="task" type="hidden" value={task.task_id} />
              {status !== "all" ? <input name="status" type="hidden" value={status} /> : null}
              <label className="input-icon">
                <span className="u-visually-hidden">Search by learner name or learner number</span>
                <Icon name="search" />
                <input className="input" defaultValue={search} name="q" placeholder="Search learners" type="search" />
              </label>
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>

            <nav aria-label="Filter by status" className="table-toolbar">
              {STATUS_FILTERS.map((option) => (
                <a
                  aria-current={option === status ? "true" : undefined}
                  className={buttonClass({ variant: option === status ? "primary" : "secondary", size: "sm" })}
                  href={`/teach/submissions?${query({ status: option === "all" ? undefined : option })}`}
                  key={option}
                >
                  {STATUS_FILTER_LABELS[option]} <span className="mono">{counts[option]}</span>
                </a>
              ))}
            </nav>

            {rows.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon="check-circle"
                  title={
                    status === "outstanding" && !search
                      ? `No one is outstanding for ${task.title}`
                      : "No learners match"
                  }
                >
                  <p>
                    {status === "outstanding" && !search
                      ? `Everyone in ${cohort.name} has handed it in: ${task.submitted} on time and ${task.late} late. There is no one to remind.`
                      : "Try another filter or search."}
                  </p>
                </EmptyState>
              </div>
            ) : (
              <SubmissionTable
                dueAt={task.due_at}
                nowIso={now.toISOString()}
                rows={rows}
                taskId={task.task_id}
                taskTitle={task.title}
              />
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
