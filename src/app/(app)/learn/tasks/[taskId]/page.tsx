import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { getMyTask } from "@/modules/submissions/queries";
import {
  CriteriaList,
  DueLine,
  RequirementChecklist,
  VersionHistory,
  type Criterion,
  type Requirement,
  type Version,
} from "@/modules/submissions/task-view";

export async function generateMetadata({ params }: { params: Promise<{ taskId: string }> }) {
  const task = await getMyTask((await params).taskId);
  return { title: task ? task.title : "Not found" };
}

// L-03 (FR-308 to FR-311): the brief, what to hand in, and every version this learner has submitted.
export default async function LearnTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ taskId: string }>;
  searchParams: Promise<{ receipt?: string; version?: string }>;
}) {
  const [{ taskId }, { receipt, version }] = await Promise.all([params, searchParams]);
  const task = await getMyTask(taskId);
  if (!task) notFound();

  const criteria = (task.criteria ?? []) as unknown as Criterion[];
  const requirements = (task.requirements ?? []) as unknown as Requirement[];
  const versions = (task.versions ?? []) as unknown as Version[];
  const latest = versions[0] ?? null;
  const closed = task.late_policy === "closed_at_due" && task.due_at !== null && new Date(task.due_at) < new Date();

  return (
    <div className="page">
      <PageHeader
        workspace="Learning"
        title={task.title}
        lead={task.cohort_name}
        meta={
          latest ? (
            latest.is_late ? (
              <Tag tone="caution">Submitted late, version {latest.version_number}</Tag>
            ) : (
              <Tag shape="half" tone="info">
                Submitted, version {latest.version_number}
              </Tag>
            )
          ) : (
            <Tag>Not started</Tag>
          )
        }
        actions={
          closed ? null : (
            <ButtonLink href={`/learn/tasks/${task.id}/submit`} variant="primary">
              {latest ? `Submit version ${latest.version_number + 1}` : "Submit your work"}
            </ButtonLink>
          )
        }
      />
      <div className="stack stack--lg">
        {receipt ? (
          <Banner title="We have your work" tone="positive">
            <p>
              Version {version} was received. Keep this reference in case you need to ask about it:{" "}
              <span className="mono">{receipt}</span>. Your work will be assessed, and you will be told here and by
              email when your result is ready.
            </p>
          </Banner>
        ) : null}

        <DueLine dueAt={task.due_at} latePolicy={task.late_policy} />

        <section aria-labelledby="brief-h" className="stack">
          <h2 className="text-heading" id="brief-h">
            What to do
          </h2>
          <p className="u-measure">{task.brief}</p>
        </section>

        <section aria-labelledby="evidence-h" className="stack">
          <h2 className="text-heading" id="evidence-h">
            What to hand in
          </h2>
          <RequirementChecklist latest={latest} requirements={requirements} />
        </section>

        <section aria-labelledby="criteria-h" className="stack">
          <h2 className="text-heading" id="criteria-h">
            How it is marked
          </h2>
          <CriteriaList criteria={criteria} />
        </section>

        <section aria-labelledby="versions-h" className="stack">
          <h2 className="text-heading" id="versions-h">
            Your versions
          </h2>
          <VersionHistory versions={versions} />
        </section>

        <p>
          <TextLink href="/learn/tasks">Back to your tasks</TextLink>
        </p>
      </div>
    </div>
  );
}
