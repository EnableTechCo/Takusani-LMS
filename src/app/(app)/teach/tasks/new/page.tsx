import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/ui/status";
import { NewTaskForm } from "@/modules/submissions/forms";
import { listWorkCohorts } from "@/modules/submissions/queries";

export const metadata = { title: "New task · Teaching" };

// F-03 create (FR-201, FR-202): the brief and the dates. The rubric and the audience are set on the draft.
export default async function NewTaskPage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const [{ cohort }, cohorts] = await Promise.all([searchParams, listWorkCohorts()]);

  return (
    <div className="page page--form">
      <PageHeader workspace="Teaching" title="New task" lead="Set work for a cohort, or for named learners in it." />
      <div className="card">
        <div className="card__body">
          {cohorts.length === 0 ? (
            <EmptyState icon="users" title="No cohort to set work in">
              <p>You set work in the cohorts your facilitator role covers. Ask a coordinator to give you the cohort.</p>
            </EmptyState>
          ) : (
            <NewTaskForm
              cohorts={cohorts.map((item) => ({
                id: item.id,
                name: item.name,
                programmeTitle: item.programme_title,
              }))}
              selected={cohort}
            />
          )}
        </div>
      </div>
    </div>
  );
}
