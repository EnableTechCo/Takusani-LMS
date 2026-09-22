"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Icon, type IconName } from "@/components/ui/icons";

/**
 * Form parts on the design system's markup (ui.css section 6). Errors are linked to their fields with
 * aria-describedby and marked aria-invalid; the error summary takes focus so a screen reader hears it.
 */

export function TextField({
  name,
  label,
  type = "text",
  error,
  help,
  defaultValue,
  autoComplete,
  optional,
  children,
}: {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  error?: string;
  help?: string;
  defaultValue?: string;
  autoComplete?: string;
  optional?: boolean;
  /** A custom control in place of the input (for example a select). It receives the same id. */
  children?: ReactNode;
}) {
  const id = `field-${name}`;
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optional ? <span className="field__optional"> (optional)</span> : null}
      </label>
      {help ? (
        <p className="field__help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          <Icon className="icon icon--sm" name="alert-circle" />
          {error}
        </p>
      ) : null}
      {children ?? (
        <input
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          autoComplete={autoComplete}
          className="input"
          defaultValue={defaultValue}
          id={id}
          name={name}
          required={!optional}
          type={type}
        />
      )}
    </div>
  );
}

/** Lists every field error with a link to the field; focused when it appears. */
export function ErrorSummary({ errors, labels }: { errors?: Record<string, string>; labels: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors ?? {});
  useEffect(() => {
    if (entries.length) ref.current?.focus();
  }, [errors, entries.length]);
  if (!entries.length) return null;
  return (
    <div className="error-summary" ref={ref} role="alert" tabIndex={-1}>
      <p className="error-summary__title">There is a problem</p>
      <ul>
        {entries.map(([name, message]) => (
          <li key={name}>
            <a href={`#field-${name}`}>{labels[name] ? `${labels[name]}: ${message}` : message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Banner({
  tone,
  title,
  children,
  icon,
}: {
  tone: "info" | "positive" | "caution" | "critical";
  title: string;
  children?: ReactNode;
  icon?: IconName;
}) {
  const defaultIcon: Record<typeof tone, IconName> = {
    info: "info",
    positive: "check-circle",
    caution: "warning",
    critical: "alert-circle",
  };
  return (
    <div className={`banner banner--${tone}`} role={tone === "critical" ? "alert" : "status"}>
      <span className="banner__icon">
        <Icon name={icon ?? defaultIcon[tone]} />
      </span>
      <p className="banner__title">{title}</p>
      {children ? <div className="banner__body">{children}</div> : null}
    </div>
  );
}

/** The form's main button. Shows progress and blocks a second submit while the request runs. */
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button aria-disabled={pending} className="btn btn--primary" disabled={pending} type="submit">
      {pending ? (
        <>
          <span aria-hidden="true" className="spinner" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
