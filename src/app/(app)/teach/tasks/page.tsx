import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listTasks } from "@/modules/submissions/queries";
import { AUDIENCE_LABELS, TASK_STATE_LABELS } from "@/modules/submissions/rules";

export const metadata = { title: "Tasks · Teaching" };

// F-02 (FR-201, FR-202): the drafts and published tasks of the cohorts this person sets work in.
export default async function TeachTasksPage() {
  const tasks = await listTasks();

  return (
    <div className="page">
      <PageHeader workspace="Teaching" title="Tasks" lead="Drafts and published tasks. Times are SAST." />
      <div className="stack stack--lg">
        <div className="cluster">
          <ButtonLink href="/teach/tasks/new" variant="primary">
            New task
          </ButtonLink>
        </div>
        {tasks.length === 0 ? (
          <div className="card">
            <EmptyState icon="clipboard" title="No tasks yet">
              <p>A task starts as a draft that only you can see. Publish it when the brief and the date are right.</p>
            </EmptyState>
          </div>
        ) : (
          <DataTable
            caption="Tasks, drafts first, then by due date. Times in SAST."
            columns={[
              {
                key: "title",
                header: "Task",
                primary: true,
                cell: (task) => (
                  <>
                    <TextLink href={`/teach/tasks/${task.id}/edit`}>{task.title}</TextLink>
                    <span className="table__secondary">{task.cohort_name}</span>
                  </>
                ),
              },
              {
                key: "state",
                header: "State",
                cell: (task) =>
                  task.state === "published" ? (
                    <Tag tone="positive">{TASK_STATE_LABELS[task.state]}</Tag>
                  ) : (
                    <Tag shape="half">{TASK_STATE_LABELS[task.state] ?? task.state}</Tag>
                  ),
              },
              {
                key: "due",
                header: "Due (SAST)",
                cell: (task) => (task.due_at ? formatDateTime(task.due_at) : "No date yet"),
              },
              {
                key: "audience",
                header: "For",
                cell: (task) =>
                  `${AUDIENCE_LABELS[task.audience] ?? task.audience} · ${task.audience_size} ${
                    task.audience_size === 1 ? "learner" : "learners"
                  }`,
              },
              {
                key: "criteria",
                header: "Rubric",
                numeric: true,
                cell: (task) => task.criteria_count,
              },
            ]}
            rowKey={(task) => task.id}
            rows={tasks}
          />
        )}
      </div>
    </div>
  );
}
