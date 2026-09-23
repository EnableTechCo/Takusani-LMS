import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Checkboxes, radios and choice cards (design system 4.3). Native inputs, so they work before scripts load and the
 * whole label row is the 44px target. A disabled option says why in its help text, linked to the input.
 */

interface CheckProps {
  name: string;
  value?: string;
  label: ReactNode;
  help?: ReactNode;
  defaultChecked?: boolean;
  disabled?: boolean;
  /** Table-row selection: a 24px target with a visually hidden label. */
  bare?: boolean;
}

function Check({ type, name, value, label, help, defaultChecked, disabled, bare }: CheckProps & { type: string }) {
  const helpId = help ? `${name}-${value ?? "on"}-help` : undefined;
  return (
    <label className={cx("check", bare && "check--bare")}>
      <input
        aria-describedby={helpId}
        className="check__input"
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        type={type}
        value={value}
      />
      <span className={bare ? "u-visually-hidden" : "check__label"}>{label}</span>
      {help && !bare ? (
        <span className="check__help" id={helpId}>
          {help}
        </span>
      ) : null}
    </label>
  );
}

export function Checkbox(props: CheckProps) {
  return <Check {...props} type="checkbox" />;
}

export function Radio(props: CheckProps & { value: string }) {
  return <Check {...props} type="radio" />;
}

/** A group of checkboxes or radios under one question. */
export function Fieldset({ legend, error, children }: { legend: ReactNode; error?: string; children: ReactNode }) {
  return (
    <fieldset aria-invalid={error ? true : undefined} className="fieldset">
      <legend className="fieldset__legend">{legend}</legend>
      {error ? <p className="field__error">{error}</p> : null}
      {children}
    </fieldset>
  );
}

/** Larger choices with a title and a description, for example "View my marked script" or "Request a remark". */
export function ChoiceGroup({
  legend,
  columns = 1,
  children,
}: {
  legend: ReactNode;
  /** Two columns where there is room; the grid is intrinsic, so a narrow panel falls back to one. */
  columns?: 1 | 2;
  children: ReactNode;
}) {
  return (
    <fieldset className="fieldset">
      <legend className="fieldset__legend">{legend}</legend>
      <div className={cx("choice-group", columns === 2 && "choice-group--2")}>{children}</div>
    </fieldset>
  );
}

export function Choice({
  type = "radio",
  name,
  value,
  title,
  description,
  meta,
  tone,
  defaultChecked,
  checked,
  onChange,
  disabled,
}: {
  type?: "radio" | "checkbox";
  name: string;
  value: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  /** Colours the card once chosen, for an outcome: Competent is positive, Not yet competent is caution. */
  tone?: "positive" | "caution";
  defaultChecked?: boolean;
  /** Controlled use, when a client component owns the value (for example a marking draft). */
  checked?: boolean;
  onChange?: () => void;
  disabled?: boolean;
}) {
  return (
    <label className={cx("choice", tone && `choice--${tone}`)}>
      <input
        checked={checked}
        className="choice__input"
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        disabled={disabled}
        name={name}
        onChange={onChange}
        type={type}
        value={value}
      />
      <span className="choice__title">{title}</span>
      {description ? <span className="choice__desc">{description}</span> : null}
      {meta ? <span className="choice__meta">{meta}</span> : null}
    </label>
  );
}
