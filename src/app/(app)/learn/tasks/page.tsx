import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listMyResults } from "@/modules/assessment/queries";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { listMyTasks } from "@/modules/submissions/queries";

export const metadata = { title: "Tasks" };

type Task = Awaited<ReturnType<typeof listMyTasks>>[number];
type Result = Awaited<ReturnType<typeof listMyResults>>[number];

/** Where a task stands for this learner: text first, tone and shape only supporting it (design system 3). */
function TaskStatus({ task, result }: { task: Task; result: Result | undefined }) {
  if (result?.state === "released") {
    return <Tag tone={result.outcome === "competent" ? "positive" : "caution"}>{OUTCOME_LABELS[result.outcome]}</Tag>;
  }
  if (task.latest_version === null) {
    const overdue = task.due_at !== null && new Date(task.due_at) < new Date();
    return overdue ? <Tag tone="caution">Not submitted, overdue</Tag> : <Tag>Not started</Tag>;
  }
  return task.latest_is_late ? (
    <Tag tone="caution">Submitted late, version {task.latest_version}</Tag>
  ) : (
    <Tag shape="half" tone="info">
      Submitted, version {task.latest_version}
    </Tag>
  );
}

// L-02 (FR-308, FR-309): the learner's published tasks and where each one stands.
export default async function LearnTasksPage() {
  const [tasks, results] = await Promise.all([listMyTasks(), listMyResults()]);
  const resultFor = new Map(results.map((result) => [result.task_id, result]));

  return (
    <div className="page">
      <PageHeader workspace="Learning" title="Tasks" lead="Your tasks and where each one stands. Times are SAST." />
      <div className="stack stack--lg">
        {tasks.length === 0 ? (
          <div className="card">
            <EmptyState icon="clipboard" title="No tasks yet">
              <p>Work set for your cohort appears here. You will be told when there is something to do.</p>
            </EmptyState>
          </div>
        ) : (
          <DataTable
            caption="Your tasks, by due date. Times in SAST."
            columns={[
              {
                key: "task",
                header: "Task",
                primary: true,
                cell: (task) => (
                  <>
                    <TextLink href={`/learn/tasks/${task.id}`}>{task.title}</TextLink>
                    <span className="table__secondary">{task.cohort_name}</span>
                  </>
                ),
              },
              {
                key: "due",
                header: "Due (SAST)",
                cell: (task) => (task.due_at ? formatDateTime(task.due_at) : "No date"),
              },
              {
                key: "status",
                header: "Status",
                cell: (task) => <TaskStatus result={resultFor.get(task.id)} task={task} />,
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
