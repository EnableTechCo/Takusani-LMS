import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDay } from "@/lib/dates";
import { listCohorts } from "@/modules/programmes/queries";
import { MODERATION_POLICY_LABELS } from "@/modules/programmes/rules";

export const metadata = { title: "Cohorts · Coordinating" };

// C-02 (FR-701): the cohorts this coordinator's role covers.
export default async function CohortsPage() {
  const cohorts = await listCohorts();

  return (
    <div className="page">
      <PageHeader workspace="Coordinating" title="Cohorts" lead="The cohorts your coordinator role covers." />
      <div className="stack stack--lg">
        <div className="cluster">
          <ButtonLink href="/coordinate/cohorts/new" variant="primary">
            New cohort
          </ButtonLink>
          <ButtonLink href="/coordinate/programmes/new">New programme</ButtonLink>
        </div>
        {cohorts.length === 0 ? (
          <div className="card">
            <EmptyState title="No cohorts yet">
              <p>Create a programme, then a cohort in it, and enrol learners.</p>
            </EmptyState>
          </div>
        ) : (
          <DataTable
            caption="Cohorts, most recent start first"
            columns={[
              {
                key: "cohort",
                header: "Cohort",
                primary: true,
                cell: (cohort) => (
                  <>
                    <Link className="link" href={`/coordinate/cohorts/${cohort.id}`}>
                      {cohort.name}
                    </Link>
                    <span className="table__secondary">{cohort.programme_title}</span>
                  </>
                ),
              },
              {
                key: "dates",
                header: "Dates",
                cell: (cohort) => `${formatDay(cohort.starts_on)} to ${formatDay(cohort.ends_on)}`,
              },
              {
                key: "moderation",
                header: "Moderation",
                cell: (cohort) => MODERATION_POLICY_LABELS[cohort.moderation_policy],
              },
              { key: "learners", header: "Learners", numeric: true, cell: (cohort) => cohort.enrolment_count },
              {
                key: "status",
                header: "Status",
                cell: (cohort) =>
                  cohort.status === "active" ? <Tag tone="positive">Active</Tag> : <Tag>Archived</Tag>,
              },
            ]}
            rowKey={(cohort) => cohort.id}
            rows={cohorts}
          />
        )}
      </div>
    </div>
  );
}
