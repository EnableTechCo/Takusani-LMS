import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listMyReportExports, listReportTypes } from "@/modules/reporting/report-queries";
import { EXPORT_STATE_LABELS, exportSize, scopeText } from "@/modules/reporting/report-rules";

export const metadata = { title: "Reports · Coordinating" };

type ExportRow = Awaited<ReturnType<typeof listMyReportExports>>[number];

// C-13 (FR-708; R-20): the programme reports a coordinator can run over the cohorts they coordinate, and their
// exports, which are built in the background and kept for 7 days.
export default async function CoordinateReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ exported?: string }>;
}) {
  const [types, exportsList, flags] = await Promise.all([listReportTypes(), listMyReportExports(), searchParams]);
  const waiting = exportsList.filter((row) => row.state === "queued" || row.state === "running").length;

  return (
    <div className="page">
      <PageHeader
        lead="Reports over the cohorts you coordinate, by programme, cohort and date range. None names a learner. Export any of them as a CSV."
        title="Reports"
        workspace="Coordinating"
      />
      <div className="stack stack--lg">
        {flags.exported ? (
          <Banner
            role="status"
            title="Export asked for. It is built in the background; you are told when it is ready."
            tone="positive"
          />
        ) : null}

        {types.length === 0 ? (
          <div className="card">
            <EmptyState icon="chart" title="No reports for you">
              <p>Reports cover the cohorts you coordinate. You do not coordinate a cohort yet.</p>
            </EmptyState>
          </div>
        ) : (
          <section aria-labelledby="types-h" className="stack">
            <h2 className="text-heading" id="types-h">
              Reports
            </h2>
            <div className="grid grid--2">
              {types.map((type) => (
                <article className="card" key={type.report_type}>
                  <div className="card__header">
                    <h3 className="card__title">
                      <TextLink href={`/coordinate/reports/${type.report_type}`}>{type.title}</TextLink>
                    </h3>
                  </div>
                  <div className="card__body stack stack--sm">
                    <p>{type.description}</p>
                    <p className="text-small text-muted">Date range: {type.date_basis.toLowerCase()}.</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section aria-labelledby="exports-h" className="stack" id="exports">
          <div className="section__header">
            <h2 className="text-heading" id="exports-h">
              Your exports
            </h2>
            {waiting > 0 ? <span className="text-meta">{waiting} being built</span> : null}
          </div>
          {exportsList.length === 0 ? (
            <div className="card">
              <EmptyState icon="download" title="No exports yet">
                <p>Open a report and choose Export as CSV. Exports are kept for 7 days.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Your report exports, newest first. Times in SAST."
              columns={[
                {
                  key: "report",
                  header: "Report",
                  primary: true,
                  cell: (row: ExportRow) => (
                    <>
                      <span className="table__primary">{row.report_title ?? row.report_type}</span>
                      <span className="table__secondary">
                        {row.programme_title}:{" "}
                        {scopeText({ cohortName: row.cohort_name, from: row.from_on, to: row.to_on })}
                      </span>
                    </>
                  ),
                },
                { key: "asked", header: "Asked for", cell: (row: ExportRow) => formatDateTime(row.requested_at) },
                {
                  key: "state",
                  header: "State",
                  cell: (row: ExportRow) => {
                    const state = EXPORT_STATE_LABELS[row.state] ?? { label: row.state, tone: "neutral" as const };
                    return (
                      <>
                        <Tag tone={state.tone}>{state.label}</Tag>
                        {row.state === "ready" ? (
                          <span className="table__secondary">
                            {exportSize(row.row_count, row.content_bytes)}. Until{" "}
                            {row.expires_at ? formatDateTime(row.expires_at) : ""}
                          </span>
                        ) : null}
                      </>
                    );
                  },
                },
                {
                  key: "download",
                  header: "Download",
                  actions: true,
                  cell: (row: ExportRow) =>
                    row.state === "ready" ? (
                      // A plain anchor: the route returns a file, not a page.
                      <a className="link" download href={`/coordinate/reports/exports/${row.export_id}`}>
                        Download CSV
                      </a>
                    ) : null,
                },
              ]}
              rowKey={(row) => row.export_id}
              rows={exportsList}
            />
          )}
        </section>
      </div>
    </div>
  );
}
