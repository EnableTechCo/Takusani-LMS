import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime, sastInputValue } from "@/lib/dates";
import { AudienceForm, CriteriaForm, EditTaskForm, PublishTask, type Criterion } from "@/modules/submissions/forms";
import { getTask } from "@/modules/submissions/queries";
import {
  AUDIENCE_LABELS,
  LATE_POLICY_LABELS,
  SUBMISSION_TYPE_LABELS,
  TASK_STATE_LABELS,
} from "@/modules/submissions/rules";

export async function generateMetadata({ params }: { params: Promise<{ taskId: string }> }) {
  const task = await getTask((await params).taskId);
  return { title: task ? `${task.title} · Teaching` : "Not found" };
}

interface NamedLearner {
  full_name: string;
  email: string;
}

// F-03 (FR-201 to FR-203): the draft's brief, rubric and audience, and the step that publishes it. A published
// task is read-only: learners plan around it, so a change is a new task.
export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ published?: string }>;
}) {
  const [{ taskId }, { published }] = await Promise.all([params, searchParams]);
  const task = await getTask(taskId);
  if (!task) notFound();

  const criteria = (task.criteria ?? []) as unknown as Criterion[];
  const named = (task.named_learners ?? []) as unknown as NamedLearner[];
  const isDraft = task.state === "draft";

  return (
    <div className="page page--form">
      <PageHeader
        workspace="Teaching"
        title={task.title}
        lead={`${task.cohort_name}. Times are SAST.`}
        meta={
          <>
            {task.state === "published" ? (
              <Tag tone="positive">{TASK_STATE_LABELS.published}</Tag>
            ) : (
              <Tag shape="half">{TASK_STATE_LABELS[task.state] ?? task.state}</Tag>
            )}
            <span className="text-meta">
              {task.due_at ? `Due ${formatDateTime(task.due_at)}` : "No due date yet"} ·{" "}
              {task.audience_size === 1 ? "1 learner" : `${task.audience_size} learners`}
            </span>
          </>
        }
        actions={
          isDraft ? (
            <PublishTask
              audienceSize={task.audience_size}
              cohortName={task.cohort_name}
              dueAt={task.due_at}
              taskId={task.id}
            />
          ) : null
        }
      />
      <div className="stack stack--lg">
        {published ? (
          <Banner title="The task is published" tone="positive">
            <p>
              {published === "1" ? "1 learner" : `${published} learners`} can see it now. Notifications and calendar
              entries follow when that part is built.
            </p>
          </Banner>
        ) : null}

        {isDraft ? (
          <>
            <section aria-labelledby="brief-h" className="stack">
              <h2 className="text-heading" id="brief-h">
                Brief
              </h2>
              <EditTaskForm
                task={{
                  id: task.id,
                  title: task.title,
                  brief: task.brief,
                  submissionType: task.submission_type,
                  dueAt: task.due_at ? sastInputValue(task.due_at) : "",
                  latePolicy: task.late_policy,
                }}
              />
            </section>
            <section aria-labelledby="rubric-h" className="stack">
              <h2 className="text-heading" id="rubric-h">
                Rubric
              </h2>
              <p className="text-small text-muted">
                What the assessor judges, in the order they will work through it. Points are optional.
              </p>
              <CriteriaForm criteria={criteria} taskId={task.id} />
            </section>
            <section aria-labelledby="audience-h" className="stack">
              <h2 className="text-heading" id="audience-h">
                Audience
              </h2>
              <AudienceForm audience={task.audience} emails={named.map((learner) => learner.email)} taskId={task.id} />
            </section>
          </>
        ) : (
          <>
            <Banner title="This task is published" tone="readonly">
              <p>
                Learners have planned around it, so it cannot be edited. To change the work, set a new task and tell
                them why.
              </p>
            </Banner>
            <section aria-labelledby="brief-h" className="stack">
              <h2 className="text-heading" id="brief-h">
                Brief
              </h2>
              <p className="u-measure">{task.brief}</p>
              <dl className="dl">
                <div className="dl__row">
                  <dt>Handed in as</dt>
                  <dd>{SUBMISSION_TYPE_LABELS[task.submission_type] ?? task.submission_type}</dd>
                </div>
                <div className="dl__row">
                  <dt>Late work</dt>
                  <dd>{LATE_POLICY_LABELS[task.late_policy] ?? task.late_policy}</dd>
                </div>
                <div className="dl__row">
                  <dt>For</dt>
                  <dd>
                    {AUDIENCE_LABELS[task.audience] ?? task.audience}
                    {task.audience === "named" ? `: ${named.map((learner) => learner.full_name).join(", ")}` : ""}
                  </dd>
                </div>
              </dl>
            </section>
            <section aria-labelledby="rubric-h" className="stack">
              <h2 className="text-heading" id="rubric-h">
                Rubric
              </h2>
              {criteria.length === 0 ? (
                <p className="text-muted">No rubric was set for this task.</p>
              ) : (
                <ol className="stack stack--sm">
                  {criteria.map((criterion, index) => (
                    <li className="card" key={index}>
                      <div className="card__body stack stack--sm">
                        <p className="card__title">
                          {criterion.title}
                          {criterion.points === null || criterion.points === undefined
                            ? ""
                            : ` · ${criterion.points} points`}
                        </p>
                        {criterion.descriptor ? <p className="text-small">{criterion.descriptor}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
        <p>
          <TextLink href="/teach/tasks">Back to tasks</TextLink>
        </p>
      </div>
    </div>
  );
}
