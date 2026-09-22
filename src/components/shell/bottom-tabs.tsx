"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icons";
import type { Workspace } from "@/modules/identity/navigation";
import { isCurrentPath } from "./current-path";
import { isBottomTab, navIcon } from "./nav-presentation";

/**
 * Phone bottom tabs for the workspace the current page belongs to (UX section 3.3): at most four destinations,
 * then "More". Hidden from 768px, where the side navigation takes over.
 */
export function BottomTabs({ workspaces }: { workspaces: Workspace[] }) {
  const pathname = usePathname();
  const workspace =
    workspaces.find((w) => pathname === `/${w.segment}` || pathname.startsWith(`/${w.segment}/`)) ?? workspaces[0];
  if (!workspace) return null;
  const tabs = workspace.items.filter((item) => isBottomTab(item.href)).slice(0, 4);

  return (
    <nav aria-label={`${workspace.label}, main destinations`} className="bottom-tabs">
      {tabs.map((tab, index) => (
        <Link
          aria-current={isCurrentPath(pathname, tab.href, index === 0) ? "page" : undefined}
          className="bottom-tabs__item"
          href={tab.href}
          key={tab.href}
        >
          <Icon name={navIcon(tab.href)} />
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
