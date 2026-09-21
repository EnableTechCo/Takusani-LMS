import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/app-shell";
import { findWorkspace, workspacesFor } from "@/modules/identity/navigation";
import { getNavigationSubject } from "@/modules/identity/session";

/**
 * Workspace landing pages until each workspace gets its own routes. A workspace the person does not hold
 * returns 404, the API convention for "not visible within your scope" (SRS 5.3; UX section 3.3).
 */
export async function generateMetadata({ params }: { params: Promise<{ workspace: string }> }) {
  const workspace = findWorkspace((await params).workspace);
  return { title: workspace ? `${workspace.items[0].label} · ${workspace.label}` : "Not found" };
}

export default async function WorkspacePage({ params }: { params: Promise<{ workspace: string }> }) {
  const { workspace: segment } = await params;
  const workspace = findWorkspace(segment);
  const held = workspacesFor(await getNavigationSubject());

  if (!workspace || !held.some((w) => w.id === workspace.id)) notFound();

  return (
    <div className="mx-auto max-w-[75rem] px-4 py-8 md:px-8">
      <PageHeader workspace={workspace.label} title={workspace.items[0].label} lead="This workspace is reserved for its first feature." />
    </div>
  );
}
