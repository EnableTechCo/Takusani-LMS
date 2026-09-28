import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Tag } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { getLearnerSubmissionHistory } from "@/modules/submissions/dashboard-queries";
import { lateBy, statusLabel } from "@/modules/submissions/dashboard-rules";

export const metadata = { title: "Learner submissions · Teaching" };

interface Version {
  version_number: number;
  submitted_at: string;
  is_late: boolean;
  late_by_seconds: number | null;
  receipt_reference: string;
}

interface Reminder {
  sent_at: string;
  sent_by: string;
  message: string;
}

// F-09 (FR-210): one learner across the tasks of the cohorts this facilitator sets work in. Every version, with its
// time, late flag and receipt, and every reminder sent. Operational status only.
export default async function LearnerSubmissionsPage({ params }: { params: Promise<{ learnerId: string }> }) {
  const history = await getLearnerSubmissionHistory((await params).learnerId);
  if (history.length === 0) notFound();
  const learner = history[0];
  const now = new Date();

  return (
    <div className="page">
      <PageHeader lead={learner.learner_number ?? undefined} title={learner.full_name} workspace="Teaching" />
      <div className="stack stack--lg">
        {history.map((task) => {
          const versions = task.versions as unknown as Version[];
          const reminders = task.reminders as unknown as Reminder[];
          return (
            <section aria-labelledby={`task-${task.task_id}`} className="card" key={task.task_id}>
              <div className="card__header">
                <h2 className="card__title" id={`task-${task.task_id}`}>
                  {task.task_title}
                </h2>
                <Tag tone={task.status === "submitted" ? "positive" : task.status === "late" ? "caution" : "neutral"}>
                  {statusLabel(task.status, task.due_at, now)}
                </Tag>
              </div>
              <div className="card__body stack">
                <p className="text-small text-muted">
                  {task.cohort_name}. {task.due_at ? `Due ${formatDateTime(task.due_at)} (SAST).` : "No due date."}
                </p>
                {versions.length === 0 ? (
                  <p>Nothing handed in yet.</p>
                ) : (
                  <ol aria-label={`Versions of ${task.task_title}, newest first`} className="history-list">
                    {versions.map((version, index) => (
                      <li
                        className={index === 0 ? "history-list__item is-current" : "history-list__item"}
                        key={version.version_number}
                      >
                        <span className="history-list__badge">v{version.version_number}</span>
                        <span className="history-list__title">
                          Version {version.version_number} {version.is_late ? <Tag tone="caution">Late</Tag> : null}
                        </span>
                        <span className="history-list__meta">
                          {formatDateTime(version.submitted_at)} (SAST)
                          {version.is_late && lateBy(version.late_by_seconds)
                            ? ` · ${lateBy(version.late_by_seconds)!.toLowerCase()}`
                            : ""}{" "}
                          · receipt <span className="mono">{version.receipt_reference}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
                <div>
                  <h3 className="text-subheading">Reminders</h3>
                  {reminders.length === 0 ? (
                    <p className="text-small text-muted">None sent.</p>
                  ) : (
                    <ul className="prose u-mt-2">
                      {reminders.map((reminder) => (
                        <li key={reminder.sent_at}>
                          {formatDateTime(reminder.sent_at)} (SAST), by {reminder.sent_by}: &ldquo;{reminder.message}
                          &rdquo;
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          );
        })}
        <p>
          <TextLink href="/teach/submissions">Back to submissions</TextLink>
        </p>
      </div>
    </div>
  );
}
