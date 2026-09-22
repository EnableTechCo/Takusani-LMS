"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icons";
import { isCurrentPath } from "./current-path";

/** A side navigation item that marks itself as the current page. Workspace roots match only exactly. */
export function NavLink({ href, label, icon, exact }: { href: string; label: string; icon: IconName; exact: boolean }) {
  const pathname = usePathname();
  return (
    <Link
      aria-current={isCurrentPath(pathname, href, exact) ? "page" : undefined}
      className="sidenav__item"
      href={href}
    >
      <Icon name={icon} />
      <span className="sidenav__label">{label}</span>
      <span aria-hidden="true" className="sidenav__short">
        {label}
      </span>
    </Link>
  );
}
