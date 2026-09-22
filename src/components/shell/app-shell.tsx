import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import type { Workspace } from "@/modules/identity/navigation";
import { Brand } from "./brand";
import { BottomTabs, NavLink } from "./nav-link";

export interface AccountSummary {
  name: string;
  email: string;
  initials: string;
  /** Roles and scopes held, one per line (read-only; FR-102). */
  details: string[];
}

/** Example institution until configuration (X-06) supplies it. */
const INSTITUTION = "Khanya Skills Institute";

function SideNav({ workspaces }: { workspaces: Workspace[] }) {
  if (workspaces.length === 0) {
    return (
      <nav aria-label="Main navigation" className="sidenav">
        <p className="text-small text-muted">No workspaces yet. Your roles are set by an administrator.</p>
      </nav>
    );
  }

  // One role: a flat list labelled by its workspace. Several: "My work" first, then a heading per workspace.
  if (workspaces.length === 1) {
    const [workspace] = workspaces;
    return (
      <nav aria-label={workspace.label} className="sidenav">
        <div className="sidenav__group">
          <ul className="sidenav__list">
            {workspace.items.map((item, index) => (
              <li key={item.href}>
                <NavLink exact={index === 0} href={item.href} icon={item.icon} label={item.label} />
              </li>
            ))}
          </ul>
        </div>
      </nav>
    );
  }

  return (
    <nav aria-label="Main navigation" className="sidenav">
      <div className="sidenav__group">
        <ul className="sidenav__list">
          <li>
            <NavLink exact href="/home" icon="house" label="My work" />
          </li>
        </ul>
      </div>
      {workspaces.map((workspace) => (
        <div className="sidenav__group" key={workspace.id}>
          <h2 className="sidenav__heading">{workspace.label}</h2>
          <ul className="sidenav__list">
            {workspace.items.map((item, index) => (
              <li key={item.href}>
                <NavLink exact={index === 0} href={item.href} icon={item.icon} label={item.label} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function AccountMenu({ account }: { account: AccountSummary }) {
  return (
    <details className="menu-wrap">
      <summary aria-label={`Account menu for ${account.name}`} className="btn btn--ghost btn--icon">
        <span aria-hidden="true" className="avatar">
          {account.initials}
        </span>
      </summary>
      <div className="menu menu--end">
        <div className="account__identity">
          <p className="account__name">{account.name}</p>
          <p className="account__email">{account.email}</p>
          <ul className="account__roles">
            {account.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <Link className="menu__item" href="/account">
          <Icon name="user" />
          Profile
        </Link>
        <Link className="menu__item" href="/notifications">
          <Icon name="bell" />
          Notification preferences
        </Link>
        <div className="menu__section">
          <fieldset className="fieldset">
            <legend className="fieldset__legend">Appearance</legend>
            <div className="segmented">
              <label className="segmented__option">
                <input defaultChecked name="theme" type="radio" value="light" />
                <span>Light</span>
              </label>
              <label className="segmented__option">
                <input name="theme" type="radio" value="dark" />
                <span>Dark</span>
              </label>
              <label className="segmented__option">
                <input name="theme" type="radio" value="auto" />
                <span>System</span>
              </label>
            </div>
          </fieldset>
        </div>
        <div className="menu__divider" role="separator" />
        <Link className="menu__item" href="/help">
          <Icon name="help" />
          Help
        </Link>
        <Link className="menu__item" href="/sign-in">
          <Icon name="sign-out" />
          Sign out
        </Link>
      </div>
    </details>
  );
}

/**
 * AppShell (UX architecture section 3; ported from the prototype's .app-shell): top bar, side navigation grouped
 * by the workspaces the person holds, and phone bottom tabs. The main landmark wraps every page.
 */
export function AppShell({
  workspaces,
  account,
  children,
}: {
  workspaces: Workspace[];
  account: AccountSummary;
  children: ReactNode;
}) {
  const tabs = workspaces.map((w) => ({
    segment: w.segment,
    label: w.label,
    tabs: w.items.filter((item) => item.tab).map(({ href, label, icon }) => ({ href, label, icon })),
  }));

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="app-shell">
        <header className="app-shell__topbar">
          <Link aria-label="Takusani LMS, go to your home page" className="brand" href="/">
            <Brand />
          </Link>
          <span className="topbar__institution">{INSTITUTION}</span>
          <span className="topbar__spacer" />
          <form className="topbar__search" role="search">
            <label className="input-icon">
              <span className="u-visually-hidden">Search materials, tasks, sessions and exams</span>
              <Icon name="search" />
              <input className="input" name="q" placeholder="Search" type="search" />
            </label>
          </form>
          <div className="topbar__actions">
            <Link aria-label="Notifications" className="btn btn--ghost btn--icon" href="/notifications">
              <Icon name="bell" />
            </Link>
            <AccountMenu account={account} />
          </div>
        </header>

        <aside aria-label={workspaces.length > 1 ? "Workspaces" : "Main navigation"} className="app-shell__sidenav">
          <SideNav workspaces={workspaces} />
        </aside>

        <main className="app-shell__main" id="main" tabIndex={-1}>
          {children}
        </main>

        <BottomTabs workspaces={tabs} />
      </div>
    </>
  );
}

/** Page title block (.page-header). Use inside <div className="page">. */
export function PageHeader({ workspace, title, lead }: { workspace?: string; title: string; lead?: string }) {
  return (
    <header className="page-header">
      {workspace ? <p className="page-header__workspace">{workspace}</p> : null}
      <h1 className="page-header__title">{title}</h1>
      {lead ? <p className="page-header__lead">{lead}</p> : null}
    </header>
  );
}
