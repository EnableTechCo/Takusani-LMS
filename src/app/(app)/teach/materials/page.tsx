import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { materialState } from "@/modules/learning/materials-rules";
import { listMaterials } from "@/modules/learning/materials-queries";

export const metadata = { title: "Materials · Teaching" };

const TONES = { Draft: "neutral", Scheduled: "info", Published: "positive", Archived: "neutral" } as const;

// F-04 (FR-204): the materials of the cohorts this person sets work in, with their state and release time.
export default async function TeachMaterialsPage() {
  const materials = await listMaterials();
  const now = new Date();
  return (
    <div className="page">
      <PageHeader
        actions={
          <ButtonLink href="/teach/materials/new" variant="primary">
            New material
          </ButtonLink>
        }
        lead="Files and links for your cohorts, published now or on a schedule. Times are SAST."
        title="Materials"
        workspace="Teaching"
      />
      {materials.length === 0 ? (
        <div className="card">
          <EmptyState icon="book" title="No materials yet">
            <p>Add a file or a link, tag it to a module, and publish it now or at a later time.</p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Materials, most recently changed first; archived last. Times in SAST."
          columns={[
            {
              key: "title",
              header: "Material",
              primary: true,
              cell: (material) => (
                <>
                  <TextLink href={`/teach/materials/${material.id}/edit`}>{material.title}</TextLink>
                  <span className="table__secondary">{material.cohort_name}</span>
                </>
              ),
            },
            { key: "module", header: "Module", cell: (material) => material.module_title ?? "No module" },
            {
              key: "kind",
              header: "Type",
              cell: (material) => (material.kind === "file" ? "File" : material.kind === "link" ? "Link" : "None yet"),
            },
            {
              key: "state",
              header: "State",
              cell: (material) => {
                const label = materialState(material.state, material.release_at, now);
                return (
                  <Tag shape={label === "Scheduled" ? "half" : undefined} tone={TONES[label]}>
                    {label}
                  </Tag>
                );
              },
            },
            {
              key: "release",
              header: "Release (SAST)",
              cell: (material) => (material.release_at ? formatDateTime(material.release_at) : "Not set"),
            },
          ]}
          rowKey={(material) => material.id}
          rows={materials}
        />
      )}
    </div>
  );
}
