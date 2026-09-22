import { cx } from "./cx";
import type { IconName } from "./icons";

/**
 * Buttons and links share one look (design system 4.2). One primary per view; verbs that name the object. The small
 * size is for dense desktop toolbars only, never navigation, sticky bars or the exam.
 */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "destructive-quiet";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonLook {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  icon?: IconName;
}

export function buttonClass({ variant = "secondary", size = "md", block }: ButtonLook, iconOnly = false): string {
  return cx("btn", `btn--${variant}`, size !== "md" && `btn--${size}`, block && "btn--block", iconOnly && "btn--icon");
}

export function iconClass(size: ButtonSize = "md"): string {
  return size === "sm" ? "icon icon--sm" : "icon";
}
