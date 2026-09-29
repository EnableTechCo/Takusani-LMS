import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { getCohortAttendance, listCohortRegisters } from "@/modules/learning/attendance-queries";
import { CohortAttendanceStats, LearnerAttendanceTable, RegistersTable } from "@/modules/learning/attendance-tables";
import { getCohort } from "@/modules/programmes/queries";

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohort((await params).cohortId);
  return { title: cohort ? `Attendance: ${cohort.name} · Coordinating` : "Not found" };
}

// C-15 (FR-209, FR-701): the cohort's attendance as the coordinator sees it: each learner's confirmed marks, lowest
// first, and each session's register. Registers are confirmed by the facilitator (F-07); the coordinator reads.
export default async function CohortAttendancePage({ params }: { params: Promise<{ cohortId: string }> }) {
  const cohort = await getCohort((await params).cohortId);
  if (!cohort) notFound();
  const [learners, registers] = await Promise.all([getCohortAttendance(cohort.id), listCohortRegisters(cohort.id)]);

  return (
    <div className="page">
      <PageHeader
        lead={`${cohort.name}, ${cohort.programme_title}. Learners check themselves in; the facilitator confirms each register. Only confirmed registers count. Times are SAST.`}
        title="Attendance"
        workspace="Coordinating"
      />
      <CohortNav cohortId={cohort.id} current="Attendance" />
      <div className="stack stack--lg">
        <CohortAttendanceStats learners={learners} registers={registers} />
        <section aria-labelledby="learners-h" className="stack">
          <h2 className="text-heading" id="learners-h">
            By learner
          </h2>
          <LearnerAttendanceTable cohortName={cohort.name} rows={learners} />
        </section>
        <section aria-labelledby="registers-h" className="stack">
          <h2 className="text-heading" id="registers-h">
            Registers
          </h2>
          <RegistersTable rows={registers} />
        </section>
      </div>
    </div>
  );
}
