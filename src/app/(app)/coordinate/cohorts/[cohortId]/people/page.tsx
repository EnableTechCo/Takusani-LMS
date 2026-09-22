import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/skeleton/skeleton";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDayOf } from "@/lib/dates";
import { EnrolLearnerForm } from "@/modules/programmes/forms";
import { getCohort, listEnrolments } from "@/modules/programmes/queries";

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohort((await params).cohortId);
  return { title: cohort ? `People: ${cohort.name} · Coordinating` : "Not found" };
}

// C-04 (FR-701): enrolled learners and enrolling one. Assigning facilitators, assessors and moderators to the
// cohort arrives with role assignment (S3-07).
export default async function CohortPeoplePage({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohort((await params).cohortId);
  if (!cohort) notFound();
  const enrolments = await listEnrolments(cohort.id);

  return (
    <div className="page">
      <PageHeader workspace="Coordinating" title="People" lead={`${cohort.name}, ${cohort.programme_title}`} />
      <CohortNav cohortId={cohort.id} current="People" />
      <div className="page-layout">
        <div className="page-layout__main stack stack--lg">
          <section aria-labelledby="learners-h">
            <div className="section__header">
              <h2 className="text-heading" id="learners-h">
                Learners
              </h2>
              <span className="text-small text-muted">{enrolments.length} enrolled</span>
            </div>
            {enrolments.length === 0 ? (
              <div className="card">
                <EmptyState icon="users" title="No learners enrolled yet">
                  <p>Enrol learners one at a time here. Bulk import arrives next sprint.</p>
                </EmptyState>
              </div>
            ) : (
              <DataTable
                caption={`Learners enrolled in ${cohort.name}`}
                columns={[
                  {
                    key: "learner",
                    header: "Learner",
                    primary: true,
                    cell: (enrolment) => (
                      <>
                        {enrolment.full_name}
                        <span className="table__secondary">{enrolment.email}</span>
                      </>
                    ),
                  },
                  { key: "number", header: "Learner number", cell: (enrolment) => enrolment.learner_number ?? "None" },
                  { key: "enrolled", header: "Enrolled", cell: (enrolment) => formatDayOf(enrolment.enrolled_at) },
                  {
                    key: "status",
                    header: "Status",
                    cell: (enrolment) =>
                      enrolment.status === "active" ? <Tag tone="positive">Enrolled</Tag> : <Tag>Withdrawn</Tag>,
                  },
                ]}
                rowKey={(enrolment) => enrolment.enrolment_id}
                rows={enrolments}
              />
            )}
          </section>
          <Block
            detail="Assigning facilitators, assessors and moderators to this cohort arrives with role assignment (S3-07)."
            heading="Staff"
            label="Roster by role"
          />
        </div>
        <aside aria-label="Enrol a learner" className="page-layout__aside stack">
          <div className="card">
            <div className="card__body stack">
              <h2 className="text-heading">Enrol a learner</h2>
              <EnrolLearnerForm cohortId={cohort.id} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
