import Link from "next/link";
import type { ReactNode } from "react";
import type { Workspace } from "@/modules/identity/navigation";
import { Brand } from "./brand";
import { NavLink } from "./nav-link";

function WorkspaceNav({ workspaces, labelledBy }: { workspaces: Workspace[]; labelledBy: string }) {
  if (workspaces.length === 0) {
    return (
      <p className="px-3 text-sm text-text-secondary">No workspaces yet. Your roles are set by an administrator.</p>
    );
  }

  // One person with one role gets a flat list; several roles get a heading per workspace (UX section 3.3).
  const grouped = workspaces.length > 1;
  return (
    <nav aria-labelledby={labelledBy} className="space-y-6">
      <h2 className="sr-only" id={labelledBy}>
        Main
      </h2>
      {workspaces.map((workspace) => (
        <div key={workspace.id}>
          {grouped && (
            <h3 className="mb-1 px-3 text-xs font-semibold tracking-wide text-text-tertiary uppercase">
              {workspace.label}
            </h3>
          )}
          <ul className="space-y-0.5">
            {workspace.items.map((item, index) => (
              <li key={item.href}>
                <NavLink exact={index === 0} href={item.href} label={item.label} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * AppShell (UX architecture section 3.2): top bar, side navigation from 1024px, and a menu on smaller screens
 * so phones are never without navigation. Bottom tabs, the 72px rail, the cohort selector and the account menu
 * arrive with the shells ticket; this is the structural frame they slot into.
 */
export function AppShell({ workspaces, children }: { workspaces: Workspace[]; children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
        <header className="sticky top-0 z-[200] flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:col-span-2">
          <Link className="rounded-sm" href="/">
            <Brand />
          </Link>
          <span className="flex-1" />
          <Link
            className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-text-secondary hover:text-text-strong"
            href="/notifications"
          >
            Notifications
          </Link>
          <details className="relative lg:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-sm border border-border-strong px-3 text-sm font-medium text-text-strong">
              Menu
            </summary>
            <div className="absolute right-0 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-md border border-border bg-surface p-3 shadow-overlay">
              <WorkspaceNav labelledBy="nav-phone" workspaces={workspaces} />
            </div>
          </details>
        </header>
        <aside className="hidden border-r border-border bg-surface px-3 py-6 lg:block">
          <WorkspaceNav labelledBy="nav-side" workspaces={workspaces} />
        </aside>
        <main className="min-w-0 focus:outline-none" id="main" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}

/** Page header: workspace label above the one H1 on the page (UX section 3.3). */
export function PageHeader({ workspace, title, lead }: { workspace?: string; title: string; lead?: string }) {
  return (
    <header className="mb-8">
      {workspace && <p className="text-xs font-semibold tracking-wide text-text-tertiary uppercase">{workspace}</p>}
      <h1 className="mt-1 font-serif text-xl tracking-tight md:text-2xl">{title}</h1>
      {lead && <p className="mt-2 max-w-[38rem] text-text-secondary">{lead}</p>}
    </header>
  );
}
