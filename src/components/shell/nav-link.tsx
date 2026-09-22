"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";

function isCurrent(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

/** A side navigation item that marks itself as the current page. Workspace roots match only exactly. */
export function NavLink({ href, label, icon, exact }: { href: string; label: string; icon: IconName; exact: boolean }) {
  const pathname = usePathname();
  return (
    <Link aria-current={isCurrent(pathname, href, exact) ? "page" : undefined} className="sidenav__item" href={href}>
      <Icon name={icon} />
      <span className="sidenav__label">{label}</span>
      <span aria-hidden="true" className="sidenav__short">
        {label}
      </span>
    </Link>
  );
}

export interface TabItem {
  href: string;
  label: string;
  icon: IconName;
}

/**
 * Phone bottom tabs for the workspace the current page belongs to (UX section 3.3): at most four destinations,
 * then "More". Hidden from 768px, where the side navigation takes over.
 */
export function BottomTabs({ workspaces }: { workspaces: { segment: string; label: string; tabs: TabItem[] }[] }) {
  const pathname = usePathname();
  const workspace =
    workspaces.find((w) => pathname === `/${w.segment}` || pathname.startsWith(`/${w.segment}/`)) ?? workspaces[0];
  if (!workspace) return null;
  const tabs = workspace.tabs.slice(0, 4);

  return (
    <nav aria-label={`${workspace.label}, main destinations`} className="bottom-tabs">
      {tabs.map((tab, index) => (
        <Link
          aria-current={isCurrent(pathname, tab.href, index === 0) ? "page" : undefined}
          className="bottom-tabs__item"
          href={tab.href}
          key={tab.href}
        >
          <Icon name={tab.icon} />
          {tab.label}
        </Link>
      ))}
      <Link className="bottom-tabs__item" href={workspaces.length > 1 ? "/home" : `/${workspace.segment}`}>
        <Icon name="menu" />
        More
      </Link>
    </nav>
  );
}
