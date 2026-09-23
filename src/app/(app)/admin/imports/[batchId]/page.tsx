import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { buttonClass, iconClass } from "@/components/ui/button-class";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { Subnav } from "@/components/ui/process";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { ImportRunner } from "@/modules/identity/import-forms";
import { getImportBatch, getImportRows } from "@/modules/identity/import-queries";

export const metadata = { title: "Import · Administration" };

const VIEWS = ["problem", "ready", "exists", "imported", "failed"] as const;
type View = (typeof VIEWS)[number];

const STATE_LABELS: Record<string, string> = {
  validated: "Checked, not imported",
  importing: "Importing",
  completed: "Completed",
  cancelled: "Cancelled",
};

// X-05 (FR-103; flow G): one intake file. What was found, what will be imported, and the import itself.
export default async function ImportBatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<{ show?: string }>;
}) {
  const [{ batchId }, { show }] = await Promise.all([params, searchParams]);
  const batch = await getImportBatch(batchId);
  if (!batch) notFound();

  const counts: Record<View, number> = {
    problem: batch.problems,
    ready: batch.ready,
    exists: batch.existing,
    imported: batch.imported,
    failed: batch.failed,
  };
  const view: View = (VIEWS as readonly string[]).includes(show ?? "")
    ? (show as View)
    : batch.problems > 0
      ? "problem"
      : batch.ready > 0
        ? "ready"
        : "imported";
  const rows = await getImportRows(batchId, view);
  const labels: Record<View, string> = {
    problem: "Problems",
    ready: "Ready",
    exists: "Already exist",
    imported: "Imported",
    failed: "Could not import",
  };
  const canImport = (batch.state === "validated" || batch.state === "importing") && batch.ready > 0;

  return (
    <div className="page">
      <PageHeader
        lead={`${batch.file_name} for ${batch.cohort_name}. Checked on ${formatDateTime(batch.created_at)} by ${batch.uploaded_by_name}.`}
        meta={
          <>
            <Tag
              shape={batch.state === "importing" ? "half" : undefined}
              tone={batch.state === "completed" ? "positive" : batch.state === "cancelled" ? "neutral" : "info"}
            >
              {STATE_LABELS[batch.state] ?? batch.state}
            </Tag>
            <span className="mono">{batch.reference}</span>
          </>
        }
        title={`Import ${batch.reference}`}
        workspace="Administration"
      />

      <div className="stack stack--lg">
        <p className="text-subheading">
          {batch.state === "completed"
            ? `${batch.imported} ${batch.imported === 1 ? "learner" : "learners"} imported and enrolled.`
            : `${batch.ready} ${batch.ready === 1 ? "row is" : "rows are"} ready to import.`}{" "}
          {batch.problems > 0
            ? `${batch.problems} ${batch.problems === 1 ? "row has a problem" : "rows have problems"}. `
            : ""}
          {batch.existing > 0
            ? `${batch.existing} already ${batch.existing === 1 ? "exists" : "exist"} and will be skipped. `
            : ""}
          {batch.failed > 0 ? `${batch.failed} could not be imported.` : ""}
        </p>

        {canImport ? (
          <section aria-labelledby="import-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="import-h">
                Import
              </h2>
            </div>
            <div className="card__body stack">
              <ImportRunner
                batchId={batch.id}
                canCancel={batch.state === "validated"}
                cohortName={batch.cohort_name}
                ready={batch.ready}
              />
            </div>
          </section>
        ) : null}

        {batch.imported > 0 ? (
          <Banner compact role="note" title="Invitations have not been sent" tone="info">
            <p>
              Email is switched off until go-live. The imported learners have accounts and are enrolled; they are
              invited to set a password when email is switched on.
            </p>
          </Banner>
        ) : null}

        <Subnav
          items={VIEWS.filter((item) => counts[item] > 0 || item === view).map((item) => ({
            label: `${labels[item]} (${counts[item]})`,
            href: `/admin/imports/${batch.id}?show=${item}`,
            current: item === view,
          }))}
          label="Rows by outcome"
        />

        {rows.length === 0 ? (
          <div className="card">
            <EmptyState title={`No rows here`} />
          </div>
        ) : (
          <DataTable
            caption={`${labels[view]}: rows of ${batch.file_name}, in file order.`}
            columns={[
              { key: "row", header: "Row", numeric: true, cell: (row) => row.row_number },
              {
                key: "name",
                header: "Name",
                primary: true,
                cell: (row) => row.full_name ?? <span className="text-muted">None</span>,
              },
              { key: "email", header: "Email", cell: (row) => row.email ?? <span className="text-muted">None</span> },
              { key: "number", header: "Learner number", cell: (row) => row.learner_number ?? "" },
              ...(view === "problem" || view === "failed"
                ? [{ key: "problem", header: "Problem", cell: (row: (typeof rows)[number]) => row.problem }]
                : []),
            ]}
            rowKey={(row) => String(row.row_number)}
            rows={rows}
          />
        )}

        <div className="cluster">
          {batch.problems > 0 ? (
            // A plain anchor: a file download, not a page for the router to navigate to.
            <a
              className={buttonClass({ variant: "secondary" })}
              download
              href={`/admin/imports/${batch.id}/problems.csv`}
            >
              <Icon className={iconClass()} name="download" />
              Download problem rows (CSV)
            </a>
          ) : null}
          <TextLink href="/admin/imports">All imports</TextLink>
        </div>
      </div>
    </div>
  );
}
