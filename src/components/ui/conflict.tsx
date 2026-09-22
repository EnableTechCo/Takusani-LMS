"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * A rule stopped a command, or allowed it with a warning (design system 4.6 and 11). A refusal names the rule, says
 * who and why in one sentence and that nothing was changed, shows the evidence, and offers alternatives, never a
 * retry. It is announced at once and focus moves to its heading. An advisory (the command succeeded, for example a
 * role assignment with a separation-of-duties note, decision U-01) must not look like a refusal: it is announced
 * politely and keeps focus where it is.
 */
export function ConflictPanel({
  title,
  children,
  evidence,
  rule,
  actions,
  advisory,
}: {
  /** Names the rule, for example "This would break separation of duties". */
  title: string;
  children: ReactNode;
  evidence?: { term: string; detail: ReactNode }[];
  /** Rule id, error code, reference and time, in monospace, for support. */
  rule?: string;
  actions?: ReactNode;
  advisory?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const headingId = useId();
  useEffect(() => {
    if (!advisory) heading.current?.focus();
  }, [advisory]);
  return (
    <div
      aria-labelledby={headingId}
      className={cx("conflict", advisory && "conflict--advisory")}
      role={advisory ? "status" : "alert"}
    >
      <h3 className="conflict__title" id={headingId} ref={heading} tabIndex={-1}>
        <Icon name={advisory ? "info" : "scales"} />
        {title}
      </h3>
      <div className="conflict__body">{children}</div>
      {evidence?.length ? (
        <dl className="conflict__evidence dl">
          {evidence.map((item) => (
            <div className="dl__row" key={item.term}>
              <dt>{item.term}</dt>
              <dd>{item.detail}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {rule ? <p className="conflict__rule">{rule}</p> : null}
      {actions ? <div className="conflict__actions">{actions}</div> : null}
    </div>
  );
}
