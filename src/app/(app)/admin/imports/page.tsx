import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listImportBatches } from "@/modules/identity/import-queries";

export const metadata = { title: "Imports · Administration" };

const STATE_LABELS: Record<string, string> = {
  validated: "Checked, not imported",
  importing: "Importing",
  completed: "Completed",
  cancelled: "Cancelled",
};

// X-05 (FR-103): every intake file loaded, newest first, with its counts, who ran it and when (flow G, step 10).
export default async function ImportsPage() {
  const batches = await listImportBatches();
  return (
    <div className="page">
      <PageHeader
        actions={
          <ButtonLink href="/admin/imports/new" variant="primary">
            New import
          </ButtonLink>
        }
        lead="Load an intake of learners from a CSV file and enrol them in a cohort. Times are SAST."
        title="Imports"
        workspace="Administration"
      />
      {batches.length === 0 ? (
        <div className="card">
          <EmptyState icon="upload" title="No imports yet">
            <p>An import checks every row first and creates nothing until you choose to import the ready rows.</p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Imports, newest first. Times in SAST."
          columns={[
            {
              key: "file",
              header: "Import",
              primary: true,
              cell: (batch) => (
                <>
                  <TextLink href={`/admin/imports/${batch.id}`}>{batch.file_name}</TextLink>
                  <span className="table__secondary mono">{batch.reference}</span>
                </>
              ),
            },
            { key: "cohort", header: "Cohort", cell: (batch) => batch.cohort_name },
            {
              key: "state",
              header: "State",
              cell: (batch) => (
                <Tag tone={batch.state === "completed" ? "positive" : batch.state === "cancelled" ? "neutral" : "info"}>
                  {STATE_LABELS[batch.state] ?? batch.state}
                </Tag>
              ),
            },
            {
              key: "rows",
              header: "Rows",
              cell: (batch) =>
                `${batch.imported} imported, ${batch.ready} ready, ${batch.problems} with problems, ${batch.existing} already exist`,
            },
            {
              key: "by",
              header: "Run by",
              cell: (batch) => (
                <>
                  {batch.uploaded_by_name}
                  <span className="table__secondary">{formatDateTime(batch.created_at)}</span>
                </>
              ),
            },
          ]}
          rowKey={(batch) => batch.id}
          rows={batches}
        />
      )}
    </div>
  );
}
