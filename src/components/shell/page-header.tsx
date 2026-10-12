import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icons";
import { Glossed } from "@/components/ui/term";

/**
 * Page title block (design system 4.1). The lead is read through the glossary: the first use of a term such as
 * "cohort" carries its meaning. Inside <div className="page">. `meta` carries one status tag and the facts
 * that identify the object (cohort, reference); `actions` carries at most one primary action and an overflow menu.
 * The top bar never holds page actions. `back` is the page this one sits under (the list a detail page came from, or
 * the record a sub-page belongs to): one link above the title, the same on every such page, so the way back never
 * depends on the browser's history.
 */
export function PageHeader({
  back,
  workspace,
  title,
  lead,
  meta,
  actions,
}: {
  /** The parent page: its address and its name as the navigation calls it ("Accounts", "Cycle"). */
  back?: { href: string; label: string };
  workspace?: string;
  title: string;
  lead?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      {back ? (
        <p className="page-header__back">
          <Link className="link link--quiet" href={back.href}>
            <Icon className="icon icon--sm" name="arrow-left" />
            {/* The space sits outside the hidden text, which would otherwise lose it ("Back toAccounts"). */}
            <span className="u-visually-hidden">Back to</span> {back.label}
          </Link>
        </p>
      ) : null}
      {workspace ? <p className="page-header__workspace">{workspace}</p> : null}
      <h1 className="page-header__title">{title}</h1>
      {lead ? (
        <p className="page-header__lead">
          <Glossed prefix="lead" text={lead} />
        </p>
      ) : null}
      {meta ? <div className="page-header__meta">{meta}</div> : null}
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}
