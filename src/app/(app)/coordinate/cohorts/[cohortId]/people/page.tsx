import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatDayOf } from "@/lib/dates";
import { roleLabel } from "@/modules/identity/roles-rules";
import { endCohortRole } from "@/modules/programmes/setup-actions";
import { CohortRoleForm } from "@/modules/programmes/setup-forms";
import { listCohortStaff } from "@/modules/programmes/setup-queries";
import { EnrolLearnerForm } from "@/modules/programmes/forms";
import { getCohort, listEnrolments } from "@/modules/programmes/queries";

const ROLE_END_BLOCKED =
  "The role was not ended: they still have open work in this cohort that no other role covers. Reallocate it first.";

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohort((await params).cohortId);
  return { title: cohort ? `People: ${cohort.name} · Coordinating` : "Not found" };
}

// C-04 (FR-701, FR-104, FR-105): enrolled learners, and the staff whose roles cover the cohort. A coordinator
// enrols learners and assigns or ends cohort roles here, with the separation-of-duties advisory (U-01).
export default async function CohortPeoplePage({
  params,
  searchParams,
}: {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ ended?: string }>;
}) {
  const [{ cohortId }, { ended }] = await Promise.all([params, searchParams]);
  const cohort = await getCohort(cohortId);
  if (!cohort) notFound();
  const [enrolments, staff] = await Promise.all([listEnrolments(cohort.id), listCohortStaff(cohort.id)]);
  const moderated = cohort.moderation_policy === "moderated";

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
                      enrolment.status === "active" ? (
                        <Tag tone="positive">Enrolled</Tag>
                      ) : enrolment.status === "pending" ? (
                        <Tag shape="half" tone="info">
                          Starts when the cohort is activated
                        </Tag>
                      ) : (
                        <Tag>Withdrawn</Tag>
                      ),
                  },
                ]}
                rowKey={(enrolment) => enrolment.enrolment_id}
                rows={enrolments}
              />
            )}
          </section>
          <section aria-labelledby="staff-h" className="stack">
            <div className="section__header">
              <h2 className="text-heading" id="staff-h">
                Staff
              </h2>
              <span className="text-small text-muted">Facilitators, assessors, moderators and coordinators</span>
            </div>
            {ended === "ok" ? <Banner compact role="status" title="Role ended" tone="positive" /> : null}
            {ended && ended !== "ok" ? (
              <Banner
                compact
                title={ended === "open_allocations" ? ROLE_END_BLOCKED : "The role could not be ended. Try again."}
                tone="critical"
              />
            ) : null}
            {staff.length === 0 ? (
              <div className="card">
                <EmptyState icon="users" title="No staff assigned yet">
                  <p>Assign a facilitator and at least one assessor{moderated ? ", and a moderator" : ""}.</p>
                </EmptyState>
              </div>
            ) : (
              <DataTable
                caption={`Staff whose roles cover ${cohort.name}. Times in SAST.`}
                columns={[
                  {
                    key: "person",
                    header: "Person",
                    primary: true,
                    cell: (person) => (
                      <>
                        {person.full_name}
                        <span className="table__secondary">{person.email}</span>
                      </>
                    ),
                  },
                  { key: "role", header: "Role", cell: (person) => roleLabel(person.role) },
                  {
                    key: "scope",
                    header: "Covers",
                    cell: (person) =>
                      person.scope_type === "cohort"
                        ? "This cohort"
                        : person.scope_type === "programme"
                          ? "The whole programme"
                          : "Every cohort",
                  },
                  {
                    key: "until",
                    header: "Until",
                    cell: (person) => (person.ends_at ? formatDateTime(person.ends_at) : "No end date"),
                  },
                  {
                    key: "actions",
                    header: "Actions",
                    actions: true,
                    cell: (person) =>
                      person.scope_type === "cohort" && person.role !== "coordinator" ? (
                        <form action={endCohortRole.bind(null, cohort.id, person.assignment_id)}>
                          <Button size="sm" type="submit" variant="ghost">
                            End {roleLabel(person.role).toLowerCase()} role
                            <span className="u-visually-hidden"> for {person.full_name}</span>
                          </Button>
                        </form>
                      ) : (
                        <span className="text-small text-muted">Managed on their account</span>
                      ),
                  },
                ]}
                rowKey={(person) => person.assignment_id}
                rows={staff}
              />
            )}
          </section>
        </div>
        <aside aria-label="Enrol a learner" className="page-layout__aside stack">
          <div className="card">
            <div className="card__body stack">
              <h2 className="text-heading">Enrol a learner</h2>
              <EnrolLearnerForm cohortId={cohort.id} />
            </div>
          </div>
          <div className="card">
            <div className="card__body stack">
              <h2 className="text-heading">Assign staff</h2>
              <CohortRoleForm cohortId={cohort.id} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
