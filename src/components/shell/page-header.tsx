import type { ReactNode } from "react";

/**
 * Page title block (design system 4.1). Inside <div className="page">. `meta` carries one status tag and the facts
 * that identify the object (cohort, reference); `actions` carries at most one primary action and an overflow menu.
 * The top bar never holds page actions.
 */
export function PageHeader({
  workspace,
  title,
  lead,
  meta,
  actions,
}: {
  workspace?: string;
  title: string;
  lead?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {workspace ? <p className="page-header__workspace">{workspace}</p> : null}
      <h1 className="page-header__title">{title}</h1>
      {lead ? <p className="page-header__lead">{lead}</p> : null}
      {meta ? <div className="page-header__meta">{meta}</div> : null}
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
