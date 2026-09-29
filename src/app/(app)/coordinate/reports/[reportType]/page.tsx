import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { SelectField, TextField } from "@/components/ui/field";
import { TextLink } from "@/components/ui/link";
import { Banner, EmptyState } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { listCohorts } from "@/modules/programmes/queries";
import { ExportReportForm } from "@/modules/reporting/report-forms";
import { listReportTypes, runReport } from "@/modules/reporting/report-queries";
import { REPORT_REFUSALS, cellText, parseScope, scopeText } from "@/modules/reporting/report-rules";

export async function generateMetadata({ params }: { params: Promise<{ reportType: string }> }) {
  const { reportType } = await params;
  const type = (await listReportTypes()).find((row) => row.report_type === reportType);
  return { title: type ? `${type.title} · Reports · Coordinating` : "Not found" };
}

// C-13 (FR-708; R-20): one report, scoped by programme, optionally one cohort, and a date range. The page previews up
// to 200 rows; the export has them all and is built in the background.
export default async function CoordinateReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportType: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ reportType }, query] = await Promise.all([params, searchParams]);
  const [types, cohorts] = await Promise.all([listReportTypes(), listCohorts()]);
  const type = types.find((row) => row.report_type === reportType);
  if (!type) notFound();

  const programmes = [...new Map(cohorts.map((row) => [row.programme_id, row.programme_title])).entries()];
  const asked = parseScope(query);
  const scope = { ...asked, programmeId: asked.programmeId ?? programmes[0]?.[0] ?? null };
  const programmeCohorts = cohorts.filter((row) => row.programme_id === scope.programmeId);
  if (scope.cohortId && !programmeCohorts.some((row) => row.id === scope.cohortId)) scope.cohortId = null;
  const report = await runReport(type.report_type, scope);
  const cohortName = programmeCohorts.find((row) => row.id === scope.cohortId)?.name ?? null;

  return (
    <div className="page">
      <PageHeader lead={type.description} title={type.title} workspace="Coordinating" />
      <div className="stack stack--lg">
        <p>
          <TextLink href="/coordinate/reports">All reports and your exports</TextLink>
        </p>
        <section aria-labelledby="scope-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="scope-h">
              Scope
            </h2>
          </div>
          <div className="card__body">
            <form action={`/coordinate/reports/${type.report_type}`} className="stack" method="get">
              <div className="grid grid--2">
                <SelectField
                  defaultValue={scope.programmeId ?? undefined}
                  label="Programme"
                  name="programme"
                  options={programmes.map(([id, title]) => ({ value: id, label: title }))}
                />
                <SelectField
                  defaultValue={scope.cohortId ?? ""}
                  help="Only cohorts you coordinate are included."
                  label="Cohort"
                  name="cohort"
                  optional
                  options={[
                    { value: "", label: "All your cohorts of the programme" },
                    ...programmeCohorts.map((row) => ({ value: row.id, label: row.name })),
                  ]}
                />
                <TextField
                  defaultValue={scope.from ?? undefined}
                  help={`${type.date_basis}, from this day.`}
                  label="From"
                  name="from"
                  optional
                  type="date"
                />
                <TextField
                  defaultValue={scope.to ?? undefined}
                  help="Up to and including this day. South African dates."
                  label="To"
                  name="to"
                  optional
                  type="date"
                />
              </div>
              <div className="cluster">
                <Button type="submit" variant="secondary">
                  Show report
                </Button>
              </div>
            </form>
          </div>
        </section>

        {!report ? (
          <div className="card">
            <EmptyState icon="chart" title="No programme to report on">
              <p>Reports cover the cohorts you coordinate.</p>
            </EmptyState>
          </div>
        ) : report.status !== "ok" ? (
          <Banner title={REPORT_REFUSALS[report.status] ?? REPORT_REFUSALS.error} tone="critical" />
        ) : (
          <section aria-labelledby="report-h" className="stack">
            <div className="section__header">
              <h2 className="text-heading" id="report-h">
                {scopeText({ cohortName, from: scope.from, to: scope.to })}
              </h2>
              <span className="text-meta">
                {report.total} {report.total === 1 ? "row" : "rows"}
              </span>
            </div>
            {report.truncated ? (
              <Banner title={`Showing the first 200 of ${report.total} rows. The export has them all.`} tone="info" />
            ) : null}
            {report.rows.length === 0 ? (
              <div className="card">
                <EmptyState icon="chart" title="Nothing in this scope">
                  <p>Try another cohort or a wider date range.</p>
                </EmptyState>
              </div>
            ) : (
              <DataTable
                caption={`${type.title}: ${scopeText({ cohortName, from: scope.from, to: scope.to })}. Times in SAST.`}
                columns={type.columns.map((column, index) => ({
                  key: column.key,
                  header: column.label,
                  primary: index === 1,
                  numeric: column.numeric,
                  cell: (row: Record<string, unknown>) => cellText(row[column.key]),
                }))}
                rowKey={(row) => type.columns.map((column) => String(row[column.key] ?? "")).join("|")}
                rows={report.rows}
              />
            )}
            <ExportReportForm scope={scope} type={type.report_type} />
          </section>
        )}
      </div>
    </div>
  );
}
