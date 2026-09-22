import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { Block, Blocks } from "@/components/skeleton/skeleton";
import { formatDay } from "@/lib/dates";
import { getCohort } from "@/modules/programmes/queries";
import { MODERATION_POLICY_LABELS } from "@/modules/programmes/rules";

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohort((await params).cohortId);
  return { title: cohort ? `${cohort.name} · Coordinating` : "Not found" };
}

// C-02 cohort overview (FR-701). A cohort outside the coordinator's scope is not found (SRS 5.3).
export default async function CohortOverviewPage({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohort((await params).cohortId);
  if (!cohort) notFound();

  return (
    <div className="page">
      <PageHeader workspace="Coordinating" title={cohort.name} lead={cohort.programme_title} />
      <CohortNav cohortId={cohort.id} current="Overview" />
      <div className="stack stack--lg">
        <dl className="grid grid--4">
          <div className="card">
            <div className="card__body">
              <dt className="text-small text-muted">Dates</dt>
              <dd>
                {formatDay(cohort.starts_on)} to {formatDay(cohort.ends_on)}
              </dd>
            </div>
          </div>
          <div className="card">
            <div className="card__body">
              <dt className="text-small text-muted">Learners enrolled</dt>
              <dd>{cohort.enrolment_count}</dd>
            </div>
          </div>
          <div className="card">
            <div className="card__body">
              <dt className="text-small text-muted">Moderation</dt>
              <dd>{MODERATION_POLICY_LABELS[cohort.moderation_policy]}</dd>
            </div>
          </div>
          <div className="card">
            <div className="card__body">
              <dt className="text-small text-muted">Status</dt>
              <dd>{cohort.status === "active" ? "Active" : "Archived"}</dd>
            </div>
          </div>
        </dl>
        <Blocks columns={2}>
          <Block
            detail="Arrives with the readiness checklist (FR-702)."
            heading="Readiness"
            label="Open readiness items"
          />
          <Block detail="Arrives with moderation planning (S4)." heading="Moderation" label="Moderation state" />
        </Blocks>
      </div>
    </div>
  );
}
