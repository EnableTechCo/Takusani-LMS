import Link from "next/link";
import type { ReactNode } from "react";
import { INSTITUTION } from "@/config/institution";
import { Icon } from "@/components/ui/icons";
import type { Theme } from "@/lib/theme";
import type { AccountSummary } from "@/modules/identity/access";
import type { Workspace } from "@/modules/identity/navigation";
import { AccountMenu } from "./account-menu";
import { BottomTabs } from "./bottom-tabs";
import { Brand } from "./brand";
import { SideNav } from "./side-nav";

/**
 * AppShell (UX architecture section 3; the prototype's .app-shell): top bar, side navigation grouped by the
 * workspaces the person holds, and phone bottom tabs. The main landmark wraps every page.
 */
export function AppShell({
  workspaces,
  account,
  theme,
  unreadNotifications,
  children,
}: {
  workspaces: Workspace[];
  account: AccountSummary;
  theme: Theme;
  /** Shown on the bell; 0 shows none. */
  unreadNotifications: number;
  children: ReactNode;
}) {
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
          <span className="topbar__institution">{INSTITUTION.name}</span>
          <span className="topbar__spacer" />
          <form action="/search" className="topbar__search" role="search">
            <label className="input-icon">
              <span className="u-visually-hidden">Search materials, tasks, sessions and exams</span>
              <Icon name="search" />
              <input className="input" name="q" placeholder="Search" type="search" />
            </label>
          </form>
          <div className="topbar__actions">
            <Link
              aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
              className="btn btn--ghost btn--icon"
              href="/notifications"
            >
              <Icon name="bell" />
              {unreadNotifications > 0 ? (
                <span aria-hidden="true" className="badge-count">
                  {unreadNotifications > 99 ? "99+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            <AccountMenu account={account} theme={theme} />
          </div>
        </header>

        <aside aria-label={workspaces.length > 1 ? "Workspaces" : "Main navigation"} className="app-shell__sidenav">
          <SideNav workspaces={workspaces} />
        </aside>

        <main className="app-shell__main" id="main" tabIndex={-1}>
          {children}
        </main>

        <BottomTabs workspaces={workspaces} />
      </div>
    </>
  );
}
