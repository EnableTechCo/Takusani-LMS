import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Process and navigation within one object (design system 4.7 and 11). */

export type StepState = "complete" | "current" | "blocked" | "skipped" | "upcoming";

const STEP_WORDS: Record<StepState, string> = {
  complete: "done",
  current: "current step",
  blocked: "blocked",
  skipped: "skipped",
  upcoming: "not yet",
};

export interface Step {
  label: string;
  state: StepState;
  /** A time or a short fact, set in monospace. */
  meta?: ReactNode;
  body?: ReactNode;
}

/**
 * The appeal timeline (vertical) and moderation progress (horizontal from 768px). Every state is a glyph, a style
 * and hidden words, so it is never carried by colour alone. The current or blocked step is the current one.
 */
export function Stepper({ label, steps, horizontal }: { label: string; steps: Step[]; horizontal?: boolean }) {
  return (
    <ol aria-label={label} className={cx("stepper", horizontal && "stepper--horizontal")}>
      {steps.map((step) => (
        <li
          aria-current={step.state === "current" || step.state === "blocked" ? "step" : undefined}
          className={cx("stepper__step", step.state !== "upcoming" && `is-${step.state}`)}
          key={step.label}
        >
          <span className="stepper__label">
            {step.label}
            <span className="u-visually-hidden"> ({STEP_WORDS[step.state]})</span>
          </span>
          {step.meta ? <span className="stepper__meta">{step.meta}</span> : null}
          {step.body ? <span className="stepper__body">{step.body}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The pages of one object, for example a cohort's Overview, Setup, People. Each is a real page, so these are links
 * with `aria-current`, not tabs.
 */
export function Subnav({
  label,
  items,
}: {
  label: string;
  items: { label: string; href: string; current?: boolean }[];
}) {
  return (
    <nav aria-label={label} className="subnav">
      {items.map((item) => (
        <Link
          aria-current={item.current ? "page" : undefined}
          className="subnav__item"
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
