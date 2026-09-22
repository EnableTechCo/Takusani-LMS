"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import { fieldId } from "./field";

/**
 * Lists every field error after a submit, each a link to its field (design system 4.3). It takes focus when it
 * appears, so a screen reader announces it and a keyboard user starts from it.
 */
export function ErrorSummary({ errors, labels }: { errors?: Record<string, string>; labels: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const entries = Object.entries(errors ?? {});
  useEffect(() => {
    if (entries.length) ref.current?.focus();
  }, [errors, entries.length]);
  if (!entries.length) return null;
  return (
    <div className="error-summary" ref={ref} role="alert" tabIndex={-1}>
      <p className="error-summary__title">
        {entries.length === 1 ? "There is a problem" : `There are ${entries.length} things to fix`}
      </p>
      <ul>
        {entries.map(([name, message]) => (
          <li key={name}>
            <a href={`#${fieldId(name)}`}>{labels[name] ? `${labels[name]}: ${message}` : message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The form's main button. While the action runs it shows a spinner, keeps focus, and ignores further presses, so a
 * command is sent once. `pendingLabel` is what assistive technology hears meanwhile, for example "Creating cohort".
 */
export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button loading={pending} loadingLabel={pendingLabel} type="submit" variant="primary">
      {children}
    </Button>
  );
}
