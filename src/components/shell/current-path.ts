/** Whether a navigation link points at the current page. Workspace roots (exact) match only themselves. */
export function isCurrentPath(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}
