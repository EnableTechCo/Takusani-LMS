import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * Form fields (design system 4.3). Label above the control, help before it, the error or confirmation after it.
 * The control is marked `aria-invalid` and described by the help and the error, so a screen reader hears both.
 * Ids are `field-<name>`, which is what the error summary links to.
 */

export const fieldId = (name: string) => `field-${name}`;

/** What a field gives its control. Spread it onto the input, select or textarea. */
export interface ControlProps {
  id: string;
  name: string;
  required: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
}

export interface FieldProps {
  name: string;
  label: ReactNode;
  help?: ReactNode;
  /** What happened and what to do, for example "Enter your reasons. We cannot review an appeal without them." */
  error?: string;
  /** A confirmation after a valid entry, for example "8 credits at NQF level 4". */
  valid?: ReactNode;
  /** Says "(optional)" after the label. Fields are required unless marked optional. */
  optional?: boolean;
  /** Says "(required)" after the label, for a form where most fields are optional. */
  markRequired?: boolean;
  /** Text at the end of the field's footer, for example "0 / 2000". */
  count?: string;
  children: (control: ControlProps) => ReactNode;
}

export function Field({ name, label, help, error, valid, optional, markRequired, count, children }: FieldProps) {
  const id = fieldId(name);
  const describedBy = [help ? `${id}-help` : null, error ? `${id}-error` : null].filter(Boolean).join(" ");
  const message = error ? (
    <p className="field__error" id={`${id}-error`}>
      <Icon className="icon icon--sm" name="alert-circle" />
      {error}
    </p>
  ) : valid ? (
    <p className="field__valid">
      <Icon className="icon icon--sm" name="check" />
      {valid}
    </p>
  ) : null;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {optional ? <span className="field__optional"> (optional)</span> : null}
        {markRequired && !optional ? <span className="field__required"> (required)</span> : null}
      </label>
      {help ? (
        <p className="field__help" id={`${id}-help`}>
          {help}
        </p>
      ) : null}
      {children({
        id,
        name,
        required: !optional,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {count ? (
        <div className="field__footer">
          {message}
          <span className="field__count">{count}</span>
        </div>
      ) : (
        message
      )}
    </div>
  );
}

type FieldOptions = Omit<FieldProps, "children" | "count">;

export function TextField({
  type = "text",
  defaultValue,
  autoComplete,
  inputMode,
  mono,
  readOnly,
  disabled,
  placeholder,
  ...field
}: FieldOptions & {
  type?: "text" | "email" | "password" | "search" | "date" | "datetime-local" | "number" | "tel" | "url";
  defaultValue?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "decimal" | "email" | "text";
  /** References and codes, set in monospace. */
  mono?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Field {...field}>
      {(control) => (
        <input
          {...control}
          autoComplete={autoComplete}
          className={cx("input", mono && "input--mono")}
          defaultValue={defaultValue}
          disabled={disabled}
          inputMode={inputMode}
          placeholder={placeholder}
          readOnly={readOnly}
          type={type}
        />
      )}
    </Field>
  );
}

export function TextareaField({
  defaultValue,
  rows = 4,
  maxLength,
  feedback,
  ...field
}: FieldOptions & {
  defaultValue?: string;
  rows?: number;
  maxLength?: number;
  /** The tall, measure-limited box for written feedback. */
  feedback?: boolean;
}) {
  return (
    <Field {...field}>
      {(control) => (
        <textarea
          {...control}
          className={cx("textarea", feedback && "textarea--feedback")}
          defaultValue={defaultValue}
          maxLength={maxLength}
          rows={rows}
        />
      )}
    </Field>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export function SelectField({
  options,
  placeholder,
  defaultValue,
  ...field
}: FieldOptions & {
  options: SelectOption[];
  /** A first, unselectable option such as "Choose a programme". */
  placeholder?: string;
  defaultValue?: string;
}) {
  const value = defaultValue ?? "";
  return (
    <Field {...field}>
      {(control) => (
        <span className="select">
          <select
            // A select ignores a changed defaultValue after a form action; re-mounting it keeps the choice. The key
            // comes before the spread, or JSX falls back to createElement and warns about the options' keys.
            key={value}
            {...control}
            defaultValue={value}
          >
            {placeholder ? (
              <option disabled value="">
                {placeholder}
              </option>
            ) : null}
            {options.map((option) => (
              <option disabled={option.disabled} key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </span>
      )}
    </Field>
  );
}
