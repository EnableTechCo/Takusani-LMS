/**
 * How the side menu behaves from tablet width up (account menu, "Side menu"). "collapsed" is an icon rail that opens
 * over the page on hover or keyboard focus; "pinned" keeps it open beside the page. Collapsed is the default.
 */
export const SIDENAV_MODES = ["collapsed", "pinned"] as const;
export type SidenavMode = (typeof SIDENAV_MODES)[number];

export const SIDENAV_COOKIE = "sidenav";

export function parseSidenavMode(value: string | undefined): SidenavMode {
  return (SIDENAV_MODES as readonly string[]).includes(value ?? "") ? (value as SidenavMode) : "collapsed";
}
