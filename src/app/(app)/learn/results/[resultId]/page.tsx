import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Tag } from "@/components/ui/status";
import { getMyResult } from "@/modules/assessment/queries";
import {
  HeldResultView,
  ReleasedResultView,
  type Mark,
  type ReleasedResult,
  type VersionFacts,
} from "@/modules/assessment/result-view";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";

export async function generateMetadata({ params }: { params: Promise<{ resultId: string }> }) {
  const result = await getMyResult((await params).resultId);
  if (!result) return { title: "Not found" };
  return {
    title:
      result.state === "released" ? `Your result for ${result.item_title}` : `${result.item_title}: being assessed`,
  };
}

// L-15 (P0-07; FR-316, FR-317, NFR-11, SRS 5.3): the learner's result. Held, it says only "Being assessed".
export default async function LearnResultPage({ params }: { params: Promise<{ resultId: string }> }) {
  const result = await getMyResult((await params).resultId);
  if (!result) notFound();

  const latestVersion = (result.latest_version ?? null) as unknown as VersionFacts | null;
  const back = (
    <p>
      <TextLink href="/learn/results">Back to your results</TextLink>
    </p>
  );

  if (result.state !== "released") {
    return (
      <div className="page">
        <PageHeader
          lead={result.cohort_name}
          meta={
            <Tag shape="half" tone="info">
              Being assessed
            </Tag>
          }
          title={`${result.item_title}: your result is not ready yet`}
          workspace="Learning"
        />
        <div className="stack stack--lg">
          <HeldResultView
            itemTitle={result.item_title}
            latestVersion={latestVersion}
            moderated={result.moderated}
            taskId={result.task_id}
          />
          {back}
        </div>
      </div>
    );
  }

  const assessedVersion = result.assessed_version as unknown as VersionFacts;
  const released: ReleasedResult = {
    resultId: result.result_id,
    taskId: result.task_id,
    itemTitle: result.item_title,
    taskClosed: result.task_closed,
    outcome: result.outcome as ReleasedResult["outcome"],
    releasedAt: result.released_at,
    appealDeadlineAt: result.appeal_deadline_at,
    remediation: result.remediation ?? null,
    remediationDeadlineAt: result.remediation_deadline_at ?? null,
    feedback: result.feedback ?? null,
    assessorName: result.assessor_name ?? null,
    marks: (result.marks ?? []) as unknown as Mark[],
    assessedVersion,
    latestVersion: latestVersion ?? assessedVersion,
    firstViewedAt: result.first_viewed_at ?? null,
  };

  return (
    <div className="page">
      <PageHeader
        lead={result.cohort_name}
        meta={
          <Tag tone={released.outcome === "competent" ? "positive" : "caution"}>{OUTCOME_LABELS[released.outcome]}</Tag>
        }
        title={`Your result for ${result.item_title}`}
        workspace="Learning"
      />
      <div className="stack stack--lg">
        <ReleasedResultView now={new Date()} result={released} />
        {back}
      </div>
    </div>
  );
}
