"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A box that may scroll: a wide table, the marking panel (audit finding A11Y-12; WCAG 2.1.1). When its content
 * overflows it becomes a focusable, labelled region, so a keyboard user can scroll it with the arrow keys; Safari
 * does not make scrollers focusable by itself. When nothing overflows it adds no tab stop and, unless it is a
 * landmark anyway, no region.
 */
export function ScrollRegion({
  label,
  className,
  as: Element = "div",
  landmark = false,
  children,
}: {
  /** What the box holds, for example the table's caption. */
  label: string;
  className?: string;
  as?: "div" | "section";
  /** Always a labelled region, scrolling or not (for example a workspace panel). */
  landmark?: boolean;
  children: ReactNode;
}) {
  const box = useRef<HTMLElement>(null);
  const [scrollable, setScrollable] = useState(false);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const check = () =>
      setScrollable(node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
    check();
    if (typeof ResizeObserver === "undefined") return;
    // The box can change size (a narrower window), and so can what is in it (another tab of the panel).
    const observer = new ResizeObserver(check);
    observer.observe(node);
    Array.from(node.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, []);

  const region = landmark || scrollable;
  return (
    <Element
      aria-label={region ? label : undefined}
      className={className}
      ref={box as never}
      role={region ? "region" : undefined}
      tabIndex={scrollable ? 0 : undefined}
    >
      {children}
    </Element>
  );
}
