import { PageHeader } from "@/components/shell/page-header";
import { Banner, EmptyState } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { getCreditReconciliation, type ReconciliationDifference } from "@/modules/credits/requirement-queries";
import { RECONCILIATION_KIND_TEXT } from "@/modules/credits/requirement-rules";

export const metadata = { title: "Credit reconciliation · Administration" };

// S6-01 (ADR-022): the daily comparison of the credit ledger with the award in force and with the unit requirements.
// It changes no credit; a difference is a fault to investigate. Administrators are told in the LMS when one is found.
export default async function AdminCreditsPage() {
  const run = await getCreditReconciliation();
  return (
    <div className="page">
      <PageHeader
        lead="Every night the credit ledger is compared with each learner's award and with the unit requirements in force. Differences are listed here; nothing is changed automatically."
        title="Credit reconciliation"
        workspace="Administration"
      />
      <div className="stack stack--lg">
        {!run || !run.lastRunAt ? (
          <div className="card">
            <EmptyState icon="chart" title="Not run yet">
              <p>The first reconciliation runs tonight at 02:40.</p>
            </EmptyState>
          </div>
        ) : (
          <>
            {run.lastStatus === "failed" ? (
              <Banner
                title={`The last run, ${formatDateTime(run.lastRunAt)}, failed. It is recorded under the scheduled jobs and runs again tonight.`}
                tone="critical"
              />
            ) : null}
            {run.lastDifferences === 0 ? (
              <Banner
                role="status"
                title={`No differences at the last successful run, ${run.lastSuccessAt ? formatDateTime(run.lastSuccessAt) : "not yet"}. The ledger and the rule agree.`}
                tone="positive"
              />
            ) : (
              <>
                <Banner
                  title={`${run.lastDifferences} ${run.lastDifferences === 1 ? "difference" : "differences"} at the last successful run, ${formatDateTime(run.lastSuccessAt!)}.`}
                  tone="critical"
                >
                  <p>Investigate each before a learner&apos;s credits are relied on. Nothing was changed.</p>
                </Banner>
                <DataTable
                  caption="Differences found by the last successful run, by learner and unit."
                  columns={[
                    {
                      key: "learner",
                      header: "Learner and unit",
                      primary: true,
                      cell: (row: ReconciliationDifference) => (
                        <>
                          <span className="table__primary">{row.learner_name}</span>
                          <span className="table__secondary">
                            {row.unit_code}: {row.unit_title}
                          </span>
                        </>
                      ),
                    },
                    {
                      key: "kind",
                      header: "Difference",
                      cell: (row: ReconciliationDifference) => RECONCILIATION_KIND_TEXT[row.kind] ?? row.kind,
                    },
                  ]}
                  rowKey={(row) => `${row.learner_name}:${row.unit_code}:${row.kind}`}
                  rows={run.differences}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
