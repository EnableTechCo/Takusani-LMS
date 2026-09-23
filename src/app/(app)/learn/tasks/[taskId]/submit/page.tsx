import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { getMyTask, listMyUploads } from "@/modules/submissions/queries";
import { LATE_POLICY_LABELS } from "@/modules/submissions/rules";
import { SubmitForm } from "@/modules/submissions/submit-form";
import type { Requirement, Version } from "@/modules/submissions/task-view";

export async function generateMetadata({ params }: { params: Promise<{ taskId: string }> }) {
  const task = await getMyTask((await params).taskId);
  return { title: task ? `Submit: ${task.title}` : "Not found" };
}

// L-03 submit (FR-308 to FR-311): add files, check, hand in. The upload is the only part that needs the browser.
export default async function SubmitTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const task = await getMyTask(taskId);
  if (!task) notFound();

  const closed = task.late_policy === "closed_at_due" && task.due_at !== null && new Date(task.due_at) < new Date();
  if (closed) redirect(`/learn/tasks/${taskId}`);

  const requirements = (task.requirements ?? []) as unknown as Requirement[];
  const versions = (task.versions ?? []) as unknown as Version[];
  const uploads = await listMyUploads(taskId);

  return (
    <div className="page page--form">
      <PageHeader
        workspace="Learning"
        title={`Submit: ${task.title}`}
        lead={`${task.cohort_name}. Your files go straight to the institution; nothing is sent until you submit.`}
      />
      <SubmitForm
        already={uploads.map((upload) => ({
          fileId: upload.file_id,
          requirementId: upload.requirement_id,
          filename: upload.original_filename,
          bytes: Number(upload.bytes),
        }))}
        latePolicySentence={LATE_POLICY_LABELS[task.late_policy] ?? task.late_policy}
        nextVersion={(versions[0]?.version_number ?? 0) + 1}
        requirements={requirements}
        taskId={task.id}
        willBeLate={task.due_at !== null && new Date(task.due_at) < new Date()}
      />
      <p className="u-mt-6">
        <TextLink href={`/learn/tasks/${taskId}`}>Back to the task</TextLink>
      </p>
    </div>
  );
}
