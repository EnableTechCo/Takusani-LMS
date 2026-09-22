import { notFound } from "next/navigation";
import { NotBuilt } from "@/components/shell/not-built";
import { findWorkspace, workspacesFor } from "@/modules/identity/navigation";
import { getNavigationSubject } from "@/modules/identity/session";

type Params = Promise<{ workspace: string; rest: string[] }>;

/** Navigation destinations inside a workspace whose screen is not built yet. Unknown paths are 404. */
async function resolve(params: Params) {
  const { workspace: segment, rest } = await params;
  const workspace = findWorkspace(segment);
  const href = `/${segment}/${rest.join("/")}`;
  const item = workspace?.items.find((i) => i.href === href);
  return { workspace, item };
}

export async function generateMetadata({ params }: { params: Params }) {
  const { workspace, item } = await resolve(params);
  return { title: workspace && item ? `${item.label} · ${workspace.label}` : "Not found" };
}

export default async function NotBuiltPage({ params }: { params: Params }) {
  const { workspace, item } = await resolve(params);
  const held = workspacesFor(await getNavigationSubject());
  if (!workspace || !item || !held.some((w) => w.id === workspace.id)) notFound();

  return <NotBuilt title={item.label} workspace={workspace.label} />;
}
