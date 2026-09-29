import { PageHeader } from "@/components/shell/page-header";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatDay } from "@/lib/dates";
import { ArchiveCohortForm } from "@/modules/programmes/archival-forms";
import { listCohortArchival } from "@/modules/programmes/archival-queries";
import { archiveConsequence, blockerLines } from "@/modules/programmes/archival-rules";

export const metadata = { title: "Cohort archive · Administration" };

type Row = Awaited<ReturnType<typeof listCohortArchival>>[number];

// X-10 (FR-111, FR-112): archive a cohort once nothing about it is still open; otherwise see each unmet condition with
// its count. An archived cohort is read-only and stays available to reports and records.
export default async function AdminCohortsPage({ searchParams }: { searchParams: Promise<{ archived?: string }> }) {
  const [rows, flags] = await Promise.all([listCohortArchival(), searchParams]);
  const active = rows.filter((row) => row.status === "active");
  const archived = rows.filter((row) => row.status === "archived");
  const justArchived = archived.find((row) => row.cohort_id === flags.archived);
  const ready = active.filter((row) => row.archivable).length;

  return (
    <div className="page">
      <PageHeader
        lead={
          ready === 0
            ? "Archive a cohort once nothing about it is still open. No active cohort is ready yet."
            : `Archive a cohort once nothing about it is still open. ${ready} ${ready === 1 ? "cohort is" : "cohorts are"} ready.`
        }
        title="Cohort archive"
        workspace="Administration"
      />
      <div className="stack stack--lg">
        {justArchived ? (
          <Banner
            role="status"
            title={`${justArchived.cohort_name} is archived. Its records are read-only and stay available to reports.`}
            tone="positive"
          />
        ) : null}

        <section aria-labelledby="active-h" className="stack">
          <h2 className="text-heading" id="active-h">
            Active cohorts
          </h2>
          <div className="card card--sunken">
            <div className="card__body">
              <p className="text-small">
                A cohort can be archived when every moderation cycle is signed off or cancelled, no result is held or
                waiting, nothing handed in is unassessed, every appeal window has closed, and no appeal or correction is
                open.
              </p>
            </div>
          </div>
          {active.length === 0 ? (
            <div className="card">
              <EmptyState icon="archive" title="No active cohorts">
                <p>Every cohort is still being set up or already archived.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Active cohorts, ending soonest first, with what still blocks archiving each."
              columns={[
                {
                  key: "cohort",
                  header: "Cohort",
                  primary: true,
                  cell: (row: Row) => (
                    <>
                      <span className="table__primary">{row.cohort_name}</span>
                      <span className="table__secondary">
                        {row.programme_title} · {formatDay(row.starts_on)} to {formatDay(row.ends_on)} · {row.learners}{" "}
                        {row.learners === 1 ? "learner" : "learners"}
                      </span>
                    </>
                  ),
                },
                {
                  key: "state",
                  header: "Can it be archived?",
                  cell: (row: Row) => {
                    const lines = blockerLines(row);
                    // The button sits here rather than in an actions column: that column does not wrap, and the
                    // consequence dialog inside it would inherit that.
                    return row.archivable ? (
                      <div className="stack stack--sm">
                        <Tag shape="check" tone="positive">
                          Ready to archive
                        </Tag>
                        <ArchiveCohortForm
                          cohortId={row.cohort_id}
                          cohortName={row.cohort_name}
                          consequence={archiveConsequence(row.cohort_name, row.learners)}
                        />
                      </div>
                    ) : (
                      <div className="stack stack--sm">
                        <Tag tone="caution">Not yet</Tag>
                        <ul className="text-small">
                          {lines.map((line) => (
                            <li key={line}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    );
                  },
                },
              ]}
              rowKey={(row) => row.cohort_id}
              rows={active}
            />
          )}
        </section>

        {archived.length > 0 ? (
          <section aria-labelledby="archived-h" className="stack">
            <h2 className="text-heading" id="archived-h">
              Archived
            </h2>
            <DataTable
              caption="Archived cohorts. Their records are read-only. Times in SAST."
              columns={[
                {
                  key: "cohort",
                  header: "Cohort",
                  primary: true,
                  cell: (row: Row) => (
                    <>
                      <span className="table__primary">{row.cohort_name}</span>
                      <span className="table__secondary">{row.programme_title}</span>
                    </>
                  ),
                },
                {
                  key: "archived",
                  header: "Archived",
                  cell: (row: Row) =>
                    `${row.archived_at ? formatDateTime(row.archived_at) : ""}${row.archived_by_name ? ` by ${row.archived_by_name}` : ""}`,
                },
                {
                  key: "learners",
                  header: "Learners",
                  numeric: true,
                  cell: (row: Row) => row.learners,
                },
              ]}
              rowKey={(row) => row.cohort_id}
              rows={archived}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
