"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** A navigation link that marks itself as the current page. Workspace roots match only exactly. */
export function NavLink({ href, label, exact }: { href: string; label: string; exact: boolean }) {
  const pathname = usePathname();
  const current = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      aria-current={current ? "page" : undefined}
      className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-text-secondary hover:bg-surface-sunken hover:text-text-strong aria-[current=page]:bg-accent-subtle aria-[current=page]:font-semibold aria-[current=page]:text-accent"
      href={href}
    >
      {label}
    </Link>
  );
}
