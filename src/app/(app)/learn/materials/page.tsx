import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { EmptyState } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDayOf } from "@/lib/dates";
import { describeContent } from "@/modules/learning/materials-rules";
import { listMyMaterials } from "@/modules/learning/materials-queries";

export const metadata = { title: "Materials" };

type Material = Awaited<ReturnType<typeof listMyMaterials>>[number];

/** Released material grouped by module, in module order; material without a module last. */
function byModule(materials: Material[]) {
  const groups = new Map<string, { heading: string; items: Material[] }>();
  for (const material of materials) {
    const key = material.module_code ?? "";
    const heading = material.module_code ? `${material.module_code}: ${material.module_title}` : "Other material";
    if (!groups.has(key)) groups.set(key, { heading, items: [] });
    groups.get(key)!.items.push(material);
  }
  return [...groups.values()];
}

// L-04 (FR-301): the material released to the learner, by module, with a search over titles and descriptions.
export default async function LearnMaterialsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const query = ((await searchParams).q ?? "").trim().slice(0, 100);
  const materials = await listMyMaterials(query);
  const groups = byModule(materials);

  return (
    <div className="page">
      <PageHeader lead="Files and links for your programme, by module." title="Materials" workspace="Learning" />
      <div className="stack stack--lg">
        <form action="/learn/materials" className="cluster" method="get" role="search">
          <label className="input-icon">
            <span className="u-visually-hidden">Search materials</span>
            <Icon name="search" />
            <input className="input" defaultValue={query} name="q" placeholder="Search materials" type="search" />
          </label>
          <Button type="submit" variant="secondary">
            Search
          </Button>
          {query ? <TextLink href="/learn/materials">Show all</TextLink> : null}
        </form>

        {query ? (
          <p aria-live="polite" className="text-small text-muted">
            {materials.length === 1 ? "1 material matches" : `${materials.length} materials match`} &ldquo;{query}
            &rdquo;.
          </p>
        ) : null}

        {materials.length === 0 ? (
          <div className="card">
            <EmptyState icon="book" title={query ? "Nothing matches" : "No materials yet"}>
              <p>
                {query
                  ? "Try fewer or different words."
                  : "When your facilitators publish material for your cohort, it appears here."}
              </p>
            </EmptyState>
          </div>
        ) : (
          groups.map((group, index) => (
            <section aria-labelledby={`module-${index}`} className="stack" key={group.heading}>
              <h2 className="text-heading" id={`module-${index}`}>
                {group.heading}
              </h2>
              <DataTable
                caption={`${group.heading}: material, newest first.`}
                columns={[
                  {
                    key: "title",
                    header: "Material",
                    primary: true,
                    cell: (material) => <TextLink href={`/learn/materials/${material.id}`}>{material.title}</TextLink>,
                  },
                  { key: "type", header: "Type", cell: (material) => describeContent(material) },
                  { key: "released", header: "Released", cell: (material) => formatDayOf(material.release_at) },
                ]}
                rowKey={(material) => material.id}
                rows={group.items}
              />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
