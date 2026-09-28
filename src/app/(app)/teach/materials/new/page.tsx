import { PageHeader } from "@/components/shell/page-header";
import { NewMaterialForm } from "@/modules/learning/materials-forms";
import { listWorkCohorts } from "@/modules/submissions/queries";

export const metadata = { title: "New material · Teaching" };

// F-04 new material (FR-204): a draft for a cohort. The file or link, module and release come on the next page.
export default async function NewMaterialPage() {
  const cohorts = await listWorkCohorts();
  return (
    <div className="page page--form">
      <PageHeader
        lead="Start with the cohort and a title. Nothing is visible to learners until you publish it."
        title="New material"
        workspace="Teaching"
      />
      <div className="card">
        <div className="card__body">
          <NewMaterialForm
            cohorts={cohorts.map((cohort) => ({ id: cohort.id, label: `${cohort.name}, ${cohort.programme_title}` }))}
          />
        </div>
      </div>
    </div>
  );
}
