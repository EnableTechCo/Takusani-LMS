import Link from "next/link";
import type { ReactNode } from "react";
import { INSTITUTION } from "@/config/institution";
import { Icon } from "@/components/ui/icons";
import type { SidenavMode } from "@/lib/sidenav";
import type { Theme } from "@/lib/theme";
import type { AccountSummary } from "@/modules/identity/access";
import type { Workspace } from "@/modules/identity/navigation";
import { AccountMenu } from "./account-menu";
import { BottomTabs } from "./bottom-tabs";
import { HistoryButtons } from "./history-buttons";
import { IdleSignOut } from "./idle-sign-out";
import { Brand } from "./brand";
import { SideNav } from "./side-nav";

/**
 * AppShell (UX architecture section 3; the prototype's .app-shell): top bar with Back and Forward, side navigation
 * grouped by the workspaces the person holds (collapsed to an icon rail or pinned open, as they chose), and phone
 * bottom tabs. The main landmark wraps every page.
 */
export function AppShell({
  workspaces,
  account,
  theme,
  sidenav,
  unreadNotifications,
  idleMinutes = 0,
  children,
}: {
  workspaces: Workspace[];
  account: AccountSummary;
  theme: Theme;
  /** The side menu from tablet width up: an icon rail that opens on hover, or pinned open. */
  sidenav: SidenavMode;
  /** Shown on the bell; 0 shows none. */
  unreadNotifications: number;
  /** Sign out after this long doing nothing, with a warning first (A11Y-07); 0 for no limit. */
  idleMinutes?: number;
  children: ReactNode;
}) {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="app-shell" data-sidenav={sidenav}>
        <header className="app-shell__topbar">
          <Link aria-label={`${INSTITUTION.product}, go to your home page`} className="brand" href="/">
            <Brand />
          </Link>
          <HistoryButtons />
          <span className="topbar__spacer" />
          <form action="/search" className="topbar__search" role="search">
            <label className="input-icon">
              <span className="u-visually-hidden">Search materials, assignments and sessions</span>
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
            <AccountMenu account={account} sidenav={sidenav} theme={theme} />
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
      <IdleSignOut idleMinutes={idleMinutes} />
    </>
  );
}
