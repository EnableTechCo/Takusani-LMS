import { notFound } from "next/navigation";
import { NotBuilt } from "@/components/shell/not-built";
import { findWorkspace, workspacesFor } from "@/modules/identity/navigation";
import { getNavigationSubject } from "@/modules/identity/session";

/**
 * Workspace landing pages that have no screen yet. A workspace the person does not hold returns 404, the
 * convention for "not visible within your scope" (SRS 5.3; UX section 3.3).
 */
export async function generateMetadata({ params }: { params: Promise<{ workspace: string }> }) {
  const workspace = findWorkspace((await params).workspace);
  return { title: workspace ? `${workspace.items[0].label} · ${workspace.label}` : "Not found" };
}

export default async function WorkspacePage({ params }: { params: Promise<{ workspace: string }> }) {
  const workspace = findWorkspace((await params).workspace);
  const held = workspacesFor(await getNavigationSubject());
  if (!workspace || !held.some((w) => w.id === workspace.id)) notFound();

  return <NotBuilt title={workspace.items[0].label} workspace={workspace.label} />;
}
