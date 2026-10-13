import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { NewProgrammeStructureForm } from "@/modules/programmes/structure-forms";
import { listProgrammeStructures } from "@/modules/programmes/structure-queries";

export const metadata = { title: "Programmes · Administration" };

type Row = Awaited<ReturnType<typeof listProgrammeStructures>>[number];

// Programme structure (FR-701, FR-108; SRS AS-03): every programme with its qualifications, units and credit total.
// Each unit of a qualification is compulsory, so the total is the sum of its units. Open one to add or import units.
export default async function AdminProgrammesPage() {
  const programmes = await listProgrammeStructures();
  return (
    <div className="page">
      <PageHeader
        lead="Each programme's qualifications and units, with their credit values. A learner earns a unit's credits when every assessment the unit needs is released as Competent."
        title="Programmes"
        workspace="Administration"
      />
      <div className="stack stack--lg">
        {programmes.length === 0 ? (
          <div className="card">
            <EmptyState icon="book" title="No programmes yet">
              <p>Create the first programme below, then add its qualifications and units or import a unit list.</p>
            </EmptyState>
          </div>
        ) : (
          <DataTable
            caption="Programmes, by title, with their qualifications, units and credit totals."
            columns={[
              {
                key: "programme",
                header: "Programme",
                primary: true,
                cell: (row: Row) => (
                  <>
                    <span className="table__primary">
                      <TextLink href={`/admin/programmes/${row.programme_id}`}>{row.title}</TextLink>
                    </span>
                    <span className="table__secondary mono">
                      {row.code}
                      {row.nqf_level ? ` · NQF Level ${row.nqf_level}` : ""}
                    </span>
                  </>
                ),
              },
              {
                key: "qualifications",
                header: "Qualifications",
                numeric: true,
                cell: (row: Row) => row.qualifications,
              },
              { key: "units", header: "Units", numeric: true, cell: (row: Row) => row.units },
              { key: "credits", header: "Total credits", numeric: true, cell: (row: Row) => row.total_credits },
              { key: "cohorts", header: "Cohorts", numeric: true, cell: (row: Row) => row.cohorts },
            ]}
            rowKey={(row) => row.programme_id}
            rows={programmes}
          />
        )}

        <section aria-labelledby="new-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="new-h">
              New programme
            </h2>
          </div>
          <div className="card__body">
            <NewProgrammeStructureForm />
          </div>
        </section>
      </div>
    </div>
  );
}
