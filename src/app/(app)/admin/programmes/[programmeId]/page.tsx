import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClass, iconClass } from "@/components/ui/button-class";
import { Icon } from "@/components/ui/icons";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDayOf } from "@/lib/dates";
import {
  AddQualificationForm,
  AddUnitForm,
  EditQualificationForm,
  EditUnitForm,
  ImportUnitListForm,
  RemoveQualificationForm,
  RemoveUnitForm,
} from "@/modules/programmes/structure-forms";
import { getProgrammeStructure } from "@/modules/programmes/structure-queries";
import { qualificationTotal, type StructureUnit } from "@/modules/programmes/structure-rules";

export async function generateMetadata({ params }: { params: Promise<{ programmeId: string }> }) {
  const programme = await getProgrammeStructure((await params).programmeId);
  return { title: programme ? `${programme.title} · Programmes · Administration` : "Not found" };
}

const FLASH: Record<string, string> = {
  "created=programme": "Programme created. Add its qualifications and units, or import a unit list.",
  "added=qualification": "Qualification added.",
  "added=unit": "Unit added.",
  "changed=qualification": "Qualification saved.",
  "changed=unit": "Unit saved.",
  "removed=unit": "Unit removed.",
  "removed=qualification": "Qualification removed.",
};

// One programme's structure (FR-701, FR-108; SRS AS-03): its qualifications, each with its units and credit total
// (every unit is compulsory), and the ways to change them: add, correct, remove while unused, or import a unit list.
// A unit's credit value changes under Configuration, where each change is dated and kept.
export default async function AdminProgrammePage({
  params,
  searchParams,
}: {
  params: Promise<{ programmeId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ programmeId }, query] = await Promise.all([params, searchParams]);
  const programme = await getProgrammeStructure(programmeId);
  if (!programme) notFound();
  const flash = Object.entries(query)
    .map(([key, value]) => FLASH[`${key}=${value}`])
    .find(Boolean);
  const total = programme.qualifications.reduce((sum, qualification) => sum + qualificationTotal(qualification), 0);
  const units = programme.qualifications.reduce((sum, qualification) => sum + qualification.units.length, 0);

  return (
    <div className="page">
      <PageHeader
        back={{ href: "/admin/programmes", label: "Programmes" }}
        lead={
          units === 0
            ? "No units yet. Add qualifications and units below, or import a unit list."
            : `${units} ${units === 1 ? "unit" : "units"}, ${total} credits in all. Every unit is compulsory.`
        }
        meta={
          <>
            <span className="mono">{programme.code}</span>
            {programme.nqf_level ? <span>NQF Level {programme.nqf_level}</span> : null}
            <span>
              {programme.cohorts} {programme.cohorts === 1 ? "cohort" : "cohorts"}
            </span>
          </>
        }
        title={programme.title}
        workspace="Administration"
      />
      <div className="stack stack--lg">
        {flash ? <Banner role="status" title={flash} tone="positive" /> : null}

        {programme.qualifications.length === 0 ? (
          <div className="card">
            <EmptyState icon="book" title="No qualifications yet">
              <p>
                Add the programme&apos;s qualification below, or import a unit list, which adds its qualifications too.
              </p>
            </EmptyState>
          </div>
        ) : (
          programme.qualifications.map((qualification) => (
            <section
              aria-labelledby={`qualification-${qualification.qualification_id}-h`}
              className="stack"
              id={`qualification-${qualification.qualification_id}`}
              key={qualification.qualification_id}
            >
              <div className="section__header">
                <h2 className="text-heading" id={`qualification-${qualification.qualification_id}-h`}>
                  {qualification.title}
                </h2>
                <span className="text-meta">
                  <span className="mono">{qualification.code}</span> · {qualificationTotal(qualification)} credits
                </span>
              </div>
              {qualification.units.length === 0 ? (
                <div className="card">
                  <EmptyState icon="book" title="No units yet">
                    <p>Add this qualification&apos;s units below, or import them.</p>
                  </EmptyState>
                  <div className="card__body">
                    <RemoveQualificationForm programmeId={programme.programme_id} qualification={qualification} />
                  </div>
                </div>
              ) : (
                <DataTable
                  caption={`Units of ${qualification.title}, by code, with their credit values.`}
                  columns={[
                    {
                      key: "unit",
                      header: "Unit",
                      primary: true,
                      cell: (unit: StructureUnit) => (
                        <>
                          <span className="table__primary">{unit.title}</span>
                          <span className="table__secondary mono">{unit.code}</span>
                        </>
                      ),
                    },
                    {
                      key: "credits",
                      header: "Credits",
                      numeric: true,
                      cell: (unit: StructureUnit) => (
                        <>
                          {unit.credits ?? "Not set"}
                          {unit.scheduled ? (
                            <span className="table__secondary">
                              {unit.scheduled.credits} from {formatDayOf(unit.scheduled.effective_from)}
                            </span>
                          ) : null}
                        </>
                      ),
                    },
                    {
                      key: "used",
                      header: "In use",
                      cell: (unit: StructureUnit) =>
                        unit.in_use ? <Tag tone="info">In use</Tag> : <span className="text-muted">Not yet</span>,
                    },
                    {
                      key: "change",
                      header: "Change",
                      cell: (unit: StructureUnit) => (
                        <details className="disclosure">
                          <summary>
                            Edit<span className="u-visually-hidden"> unit {unit.code}</span>
                          </summary>
                          <div className="stack u-mt-2">
                            <EditUnitForm programmeId={programme.programme_id} unit={unit} />
                            {unit.in_use ? null : <RemoveUnitForm programmeId={programme.programme_id} unit={unit} />}
                          </div>
                        </details>
                      ),
                    },
                  ]}
                  rowKey={(unit) => unit.unit_id}
                  rows={qualification.units}
                />
              )}
              <details className="disclosure">
                <summary>
                  Edit qualification<span className="u-visually-hidden"> {qualification.code}</span>
                </summary>
                <div className="u-mt-2">
                  <EditQualificationForm programmeId={programme.programme_id} qualification={qualification} />
                </div>
              </details>
            </section>
          ))
        )}

        <div className="grid grid--2">
          {programme.qualifications.length > 0 ? (
            <section aria-labelledby="add-unit-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="add-unit-h">
                  Add a unit
                </h2>
              </div>
              <div className="card__body">
                <AddUnitForm
                  programmeId={programme.programme_id}
                  qualifications={programme.qualifications.map((qualification) => ({
                    value: qualification.qualification_id,
                    label: `${qualification.code}: ${qualification.title}`,
                  }))}
                />
              </div>
            </section>
          ) : null}
          <section aria-labelledby="add-qualification-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="add-qualification-h">
                Add a qualification
              </h2>
            </div>
            <div className="card__body">
              <AddQualificationForm programmeId={programme.programme_id} />
            </div>
          </section>
        </div>

        <section aria-labelledby="import-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="import-h">
              Import a unit list
            </h2>
          </div>
          <div className="card__body stack">
            <ul className="prose">
              <li>
                One line per unit, under a first line naming the columns:{" "}
                <span className="mono">qualification_code</span>, <span className="mono">qualification_title</span>,{" "}
                <span className="mono">unit_code</span>, <span className="mono">unit_title</span>,{" "}
                <span className="mono">credits</span>.
              </li>
              <li>A new qualification needs its title on its first line. One already here needs only its code.</li>
              <li>
                Every line is checked first, and nothing is added while any line has a problem. Units already here are
                left as they are, so importing a file twice adds nothing twice.
              </li>
            </ul>
            <p>
              {/* A plain anchor: a file download, not a page for the router to navigate to. */}
              <a className={buttonClass({ variant: "secondary" })} download href="/admin/programmes/template.csv">
                <Icon className={iconClass()} name="download" />
                Download the CSV template
              </a>
            </p>
            <ImportUnitListForm programmeId={programme.programme_id} />
          </div>
        </section>
      </div>
    </div>
  );
}
