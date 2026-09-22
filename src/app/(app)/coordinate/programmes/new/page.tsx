import { PageHeader } from "@/components/shell/page-header";
import { NewProgrammeForm } from "@/modules/programmes/forms";

export const metadata = { title: "New programme · Coordinating" };

// FR-701 "create a programme". Coordinators with the institution-wide role only; the database refuses others.
// Qualifications, units and modules are added once the unit list is supplied (SRS AS-03).
export default function NewProgrammePage() {
  return (
    <div className="page page--form">
      <PageHeader
        workspace="Coordinating"
        title="New programme"
        lead="A programme groups its qualifications, units and cohorts."
      />
      <div className="card">
        <div className="card__body">
          <NewProgrammeForm />
        </div>
      </div>
    </div>
  );
}
