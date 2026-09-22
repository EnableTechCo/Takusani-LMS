/**
 * Sticky regions and WCAG 2.4.11 (accessibility audit A11Y-02 to A11Y-04). The top bar, section switcher, bottom
 * tabs, action and decision bars and the exam bars change height with zoom, language and content, so the space
 * they cover is measured at run time rather than taken from fixed tokens. ui.css derives scroll-padding from
 * --sticky-top and --sticky-bottom, so a focused control or anchor target is never hidden behind them.
 */

export const STICKY_TOP = [".app-shell__topbar", ".exam-shell__bar", ".section-switcher"] as const;
export const STICKY_BOTTOM = [".bottom-tabs", ".action-bar", ".decision-bar", ".exam-shell__actions"] as const;

export interface StickyRegion {
  edge: "top" | "bottom";
  /** Rendered height in CSS pixels. */
  height: number;
  /** Only regions that are displayed and currently position: sticky (or fixed) cover content. */
  covering: boolean;
}

export function stickyInsets(regions: readonly StickyRegion[]): { top: number; bottom: number } {
  const sum = (edge: StickyRegion["edge"]) =>
    regions.filter((r) => r.edge === edge && r.covering).reduce((total, r) => total + Math.ceil(r.height), 0);
  return { top: sum("top"), bottom: sum("bottom") };
}
