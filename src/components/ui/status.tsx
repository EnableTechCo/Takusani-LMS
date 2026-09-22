import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./icons";

/**
 * Status and feedback (design system 3 and 4.6). Every status is text first; tone and shape support it, so no state
 * relies on colour alone. Critical is for system faults, blocking validation and destructive confirmation only,
 * never for a learner's outcome.
 */

export type Tone = "neutral" | "info" | "positive" | "caution" | "critical";
export type TagShape = "ring" | "dot" | "half" | "check" | "diamond" | "cross" | "square";

/**
 * A status word. Each tone has its own shape (ring, dot, check, diamond, cross); `shape` overrides it, for example
 * "half" for something in progress or "square" for something final. `plain` has no shape.
 */
export function Tag({
  tone = "neutral",
  shape,
  plain,
  large,
  children,
}: {
  tone?: Tone;
  shape?: TagShape;
  plain?: boolean;
  /** The outcome on a result. */
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "tag",
        tone !== "neutral" && `tag--${tone}`,
        shape && `tag--shape-${shape}`,
        plain && "tag--plain",
        large && "tag--lg",
      )}
    >
      {children}
    </span>
  );
}

export type BannerTone = Exclude<Tone, "neutral"> | "readonly" | "offline";

const BANNER_ICONS: Record<BannerTone, IconName> = {
  info: "info",
  positive: "check-circle",
  caution: "info",
  critical: "warning",
  readonly: "archive",
  offline: "offline",
};

/**
 * A state that colours the whole page and stays while it is true, in the page flow under the header. Announced
 * politely, or at once for a critical, blocking or offline state; pass `role` to override.
 */
export function Banner({
  tone,
  title,
  children,
  actions,
  icon,
  compact,
  role,
}: {
  tone: BannerTone;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  compact?: boolean;
  role?: "status" | "alert" | "note";
}) {
  const urgent = tone === "critical" || tone === "offline";
  return (
    <div
      className={cx("banner", `banner--${tone}`, compact && "banner--compact")}
      role={role ?? (urgent ? "alert" : "status")}
    >
      <Icon className="icon banner__icon" name={icon ?? BANNER_ICONS[tone]} />
      <p className="banner__title">{title}</p>
      {children ? <div className="banner__body">{children}</div> : null}
      {actions ? <div className="banner__actions">{actions}</div> : null}
    </div>
  );
}

export type StatusLineState = "saving" | "local" | "saved" | "locked" | "problem" | "critical";

const STATUS_LINE_ICONS: Record<Exclude<StatusLineState, "saving">, IconName> = {
  local: "device",
  saved: "cloud-check",
  locked: "lock",
  problem: "offline",
  critical: "warning",
};

/**
 * Persistent text in a fixed place: autosave, drafts, uploads. Never a toast. The wording is fixed by the design
 * system (3.3), for example "Saved on this device" or "Not saved to the server".
 */
export function StatusLine({ state, time, children }: { state: StatusLineState; time?: string; children: ReactNode }) {
  return (
    <span className={cx("status-line", state !== "saving" && `status-line--${state}`)} role="status">
      {state === "saving" ? <span aria-hidden="true" className="spinner" /> : <Icon name={STATUS_LINE_ICONS[state]} />}
      {children}
      {time ? <span className="status-line__time"> {time}</span> : null}
    </span>
  );
}

/** A measured value against a limit, for example a held result's age. Always paired with visible text. */
export function Meter({
  label,
  value,
  max,
  valueText,
  caution,
}: {
  label: string;
  value: number;
  max: number;
  /** The value in words, shown and announced, for example "12 of 30 days". */
  valueText: string;
  caution?: boolean;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="stack stack--sm">
      <div className="cluster cluster--between text-small">
        <span>{label}</span>
        <span className="mono">{valueText}</span>
      </div>
      <div
        aria-label={label}
        aria-valuemax={max}
        aria-valuemin={0}
        aria-valuenow={value}
        aria-valuetext={valueText}
        className={cx("meter", caution && "meter--caution")}
        role="meter"
      >
        <span className="meter__bar" style={{ ["--value" as string]: `${percent}%` }} />
      </div>
    </div>
  );
}

/** Nothing to show yet: what will appear here and when, and what to do meanwhile. */
export function EmptyState({
  icon = "inbox",
  title,
  children,
  actions,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon className="icon icon--lg" name={icon} />
      </span>
      <p className="empty__title">{title}</p>
      {children ? <div className="empty__body">{children}</div> : null}
      {actions ? <div className="empty__actions">{actions}</div> : null}
    </div>
  );
}
