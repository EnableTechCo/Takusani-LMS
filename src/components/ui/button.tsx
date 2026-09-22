"use client";

import type { ButtonHTMLAttributes } from "react";
import { buttonClass, iconClass, type ButtonLook } from "./button-class";
import { cx } from "./cx";
import { Icon, type IconName } from "./icons";

/**
 * Buttons that do something in the browser (design system 4.2). For navigation use ButtonLink; to submit a form use
 * `type="submit"` (or SubmitButton, which shows progress). A disabled action states its reason in visible text next
 * to it (BlockedReason), never only as a disabled state.
 */

export interface ButtonProps extends ButtonLook, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  /**
   * The command is running. The label stays for assistive technology (as `loadingLabel` when given, for example
   * "Saving, please wait"); a spinner replaces it visually. The button keeps focus and ignores further presses.
   */
  loading?: boolean;
  loadingLabel?: string;
  className?: string;
}

export function Button({
  variant,
  size,
  block,
  icon,
  loading,
  loadingLabel,
  className,
  type = "button",
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      aria-busy={loading || undefined}
      aria-label={loading && loadingLabel ? loadingLabel : rest["aria-label"]}
      className={cx(buttonClass({ variant, size, block }), loading && "is-loading", className)}
      onClick={(event) => {
        // Not `disabled`: disabling the focused button would drop focus to the page. Pressing Enter in a field
        // submits through this click too, so the guard also stops a second submit from the keyboard.
        if (loading) event.preventDefault();
        else onClick?.(event);
      }}
      type={type}
    >
      {icon ? <Icon className={iconClass(size)} name={icon} /> : null}
      {children}
    </button>
  );
}

/** An icon-only button. The label is its accessible name. */
export function IconButton({
  label,
  icon,
  variant = "ghost",
  size,
  ...rest
}: Omit<ButtonProps, "children" | "block" | "aria-label" | "loading" | "loadingLabel"> & {
  label: string;
  icon: IconName;
}) {
  return (
    <button {...rest} aria-label={label} className={buttonClass({ variant, size }, true)} type={rest.type ?? "button"}>
      <Icon className={iconClass(size)} name={icon} />
    </button>
  );
}
