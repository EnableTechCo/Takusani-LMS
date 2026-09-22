"use client";

import { useEffect } from "react";
import { STICKY_BOTTOM, STICKY_TOP, stickyInsets, type StickyRegion } from "@/lib/sticky-insets";

function measure(): StickyRegion[] {
  const regions: StickyRegion[] = [];
  for (const [edge, selectors] of [
    ["top", STICKY_TOP],
    ["bottom", STICKY_BOTTOM],
  ] as const) {
    for (const element of document.querySelectorAll<HTMLElement>(selectors.join(","))) {
      const style = getComputedStyle(element);
      const covering =
        style.display !== "none" && !element.hidden && (style.position === "sticky" || style.position === "fixed");
      regions.push({ edge, height: element.getBoundingClientRect().height, covering });
    }
  }
  return regions;
}

/**
 * Keeps --sticky-top and --sticky-bottom equal to the height of the sticky regions actually on screen, so
 * scroll-padding keeps the focused element clear of them at any zoom (WCAG 2.4.11; audit A11Y-02 to A11Y-04).
 * Without JavaScript the fixed values in ui.css still apply.
 */
export function StickyInsets() {
  useEffect(() => {
    const root = document.documentElement;
    // Measuring is a handful of elements, so it runs straight away rather than on an animation frame, which
    // browsers pause in background tabs.
    const update = () => {
      const { top, bottom } = stickyInsets(measure());
      root.style.setProperty("--sticky-top", `${top}px`);
      root.style.setProperty("--sticky-bottom", `${bottom}px`);
    };

    const resize = new ResizeObserver(update);
    const observeAll = () => {
      resize.disconnect();
      document.querySelectorAll<HTMLElement>([...STICKY_TOP, ...STICKY_BOTTOM].join(",")).forEach((element) => {
        resize.observe(element);
      });
      update();
    };
    // Regions come and go with navigation and state (a decision bar appears, bottom tabs hide on desktop).
    const mutations = new MutationObserver(observeAll);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    window.addEventListener("resize", update);
    observeAll();

    return () => {
      resize.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--sticky-top");
      root.style.removeProperty("--sticky-bottom");
    };
  }, []);

  return null;
}
