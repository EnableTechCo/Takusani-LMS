import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { Block } from "@/components/skeleton/skeleton";
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
      <div className="u-mb-4">
        <CohortNav cohortId={cohort.id} current="People" />
      </div>
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
                <div className="empty">
                  <p className="empty__title">No learners enrolled yet</p>
                  <p className="empty__body">Enrol learners one at a time here. Bulk import arrives next sprint.</p>
                </div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table table--cards">
                  <caption className="u-visually-hidden">Learners enrolled in {cohort.name}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Learner</th>
                      <th scope="col">Learner number</th>
                      <th scope="col">Enrolled</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrolments.map((enrolment) => (
                      <tr key={enrolment.enrolment_id}>
                        <th className="table__primary-cell" data-label="Learner" scope="row">
                          {enrolment.full_name}
                          <span className="table__secondary">{enrolment.email}</span>
                        </th>
                        <td data-label="Learner number">{enrolment.learner_number ?? "None"}</td>
                        <td data-label="Enrolled">{formatDayOf(enrolment.enrolled_at)}</td>
                        <td data-label="Status">
                          <span className={enrolment.status === "active" ? "tag tag--positive" : "tag"}>
                            {enrolment.status === "active" ? "Enrolled" : "Withdrawn"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
