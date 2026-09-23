import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { getMyAccess } from "@/modules/identity/session";
import { getMarkingItem, signEvidence, type EvidenceFile } from "@/modules/assessment/queries";
import { INSTANCE_STATE_LABELS } from "@/modules/assessment/rules";
import { MarkingWorkspace, type Criterion, type StoredDraft, type Version } from "@/modules/assessment/workspace";

export async function generateMetadata({ params }: { params: Promise<{ instanceId: string }> }) {
  const item = await getMarkingItem((await params).instanceId);
  return { title: item ? `${item.learner_name}, ${item.task_title} · Assessing` : "Not found" };
}

// A-02, P0-11 (FR-401 to FR-405): the marking workspace. Outside the assessor's scope this is a 404, and the attempt
// is audited by the database (FR-401).
export default async function MarkingPage({ params }: { params: Promise<{ instanceId: string }> }) {
  const { instanceId } = await params;
  const [item, access] = await Promise.all([getMarkingItem(instanceId), getMyAccess()]);
  if (!item) notFound();

  const versions = (item.versions ?? []) as unknown as (Version & { files: EvidenceFile[] })[];
  const links = await signEvidence(versions.flatMap((version) => version.files));
  const mine = item.assessor_id === access?.profile_id;

  return (
    <div className="page page--full">
      <PageHeader
        workspace="Assessing"
        title={`${item.learner_name}: ${item.task_title}`}
        lead={`${item.cohort_name}${item.learner_number ? ` · ${item.learner_number}` : ""}. Version ${
          item.version_number
        } of ${versions.length}, submitted ${formatDateTime(item.submitted_at)} (SAST)${item.is_late ? ", late" : ""}.`}
        meta={
          <>
            <Tag shape={item.instance_state === "marking" ? "half" : undefined} tone="info">
              {INSTANCE_STATE_LABELS[item.instance_state] ?? item.instance_state}
            </Tag>
            <span className="text-meta">
              {item.moderation_policy === "moderated" ? "Moderated cohort" : "Not moderated"}
            </span>
          </>
        }
      />
      {item.instance_state === "superseded" ? (
        <Banner title="This version was replaced" tone="info">
          <p>
            {item.learner_name} handed in a later version, which is in the queue to be marked. This version and anything
            drafted on it stay on record, but it is no longer marked.
          </p>
        </Banner>
      ) : null}
      <MarkingWorkspace
        canMark={mine && item.instance_state === "marking"}
        canTake={item.instance_state === "to_mark"}
        criteria={(item.criteria ?? []) as unknown as Criterion[]}
        decisions={
          (item.decisions ?? []) as unknown as {
            type: string;
            outcome: string;
            acting_role: string;
            created_at: string;
          }[]
        }
        instanceId={item.instance_id}
        links={links}
        moderated={item.moderation_policy === "moderated"}
        stored={(item.draft ?? null) as unknown as StoredDraft | null}
        takenBySomeoneElse={item.assessor_id && !mine ? item.assessor_name : null}
        learnerName={item.learner_name}
        decided={
          item.instance_state === "decided"
            ? {
                resultState: item.result_state,
                releasedAt: item.result_released_at,
                appealDeadlineAt: item.result_appeal_deadline_at,
                remediationDeadlineAt: item.result_remediation_deadline_at,
              }
            : null
        }
        versions={versions}
      />
      <p className="u-mt-6">
        <TextLink href="/assess">Back to the queue</TextLink>
      </p>
    </div>
  );
}
