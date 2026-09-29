import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/status";
import { getCohortAttendance, listCohortRegisters } from "@/modules/learning/attendance-queries";
import { CohortAttendanceStats, LearnerAttendanceTable, RegistersTable } from "@/modules/learning/attendance-tables";
import { listWorkCohorts } from "@/modules/submissions/queries";

export const metadata = { title: "Attendance · Teaching" };

// F-12 (FR-209): a cohort's attendance at a glance: each learner's confirmed marks, lowest first, and each session's
// register with the check-ins so far or the confirmed counts. Only confirmed registers count towards a rate.
export default async function TeachAttendancePage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const params = await searchParams;
  const cohorts = await listWorkCohorts();
  const cohort = cohorts.find((row) => row.id === params.cohort) ?? cohorts[0];

  if (!cohort) {
    return (
      <div className="page">
        <PageHeader title="Attendance" workspace="Teaching" />
        <div className="card">
          <EmptyState icon="users" title="No cohorts to show">
            <p>Attendance appears here for the cohorts you set work in.</p>
          </EmptyState>
        </div>
      </div>
    );
  }

  const [learners, registers] = await Promise.all([getCohortAttendance(cohort.id), listCohortRegisters(cohort.id)]);

  return (
    <div className="page">
      <PageHeader
        lead="Learners check themselves in while a session is on; you confirm each register. Only confirmed registers count. Times are SAST."
        title="Attendance"
        workspace="Teaching"
      />
      <div className="stack stack--lg">
        {cohorts.length > 1 ? (
          <form action="/teach/attendance" className="cluster" method="get">
            <label className="field__label" htmlFor="cohort-select">
              Cohort
            </label>
            <span className="select">
              <select defaultValue={cohort.id} id="cohort-select" name="cohort">
                {cohorts.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}, {row.programme_title}
                  </option>
                ))}
              </select>
            </span>
            <Button type="submit" variant="secondary">
              Show
            </Button>
          </form>
        ) : (
          <p className="text-small text-muted">{cohort.name}</p>
        )}

        <CohortAttendanceStats learners={learners} registers={registers} />

        <section aria-labelledby="learners-h" className="stack">
          <h2 className="text-heading" id="learners-h">
            By learner
          </h2>
          <LearnerAttendanceTable cohortName={cohort.name} rows={learners} />
        </section>

        <section aria-labelledby="registers-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="registers-h">
              Registers
            </h2>
            <TextLink href="/teach/sessions">All sessions</TextLink>
          </div>
          <RegistersTable registerHref={(row) => `/teach/sessions/${row.session_id}/register`} rows={registers} />
        </section>
      </div>
    </div>
  );
}
