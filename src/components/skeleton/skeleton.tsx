import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Screen skeletons. Every route in the UX architecture's screen inventory renders one: the real page frame,
 * headings, form labels and primary actions, with each piece of content drawn as a labelled block that says what
 * will go there. A feature ticket replaces the blocks with real components and data, one screen at a time.
 */

/**
 * A primary or secondary action. A string renders a disabled button; `href` renders a working link, styled as a
 * button unless `plain` is set.
 */
export type Action = string | { label: string; href: string; plain?: boolean };

export function Actions({ actions, className }: { actions: Action[]; className: string }) {
  return (
    <div className={className}>
      {actions.map((action, index) => {
        const tone = index === 0 ? "btn btn--primary" : "btn btn--secondary";
        return typeof action === "string" ? (
          <button className={tone} disabled key={action} type="button">
            {action}
          </button>
        ) : (
          <Link className={action.plain ? "link" : tone} href={action.href} key={action.label}>
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}

function ScreenMeta({ id, frs }: { id: string; frs?: string }) {
  return (
    <div className="page-header__meta">
      <span className="tag">Skeleton</span>
      <span className="text-meta mono">
        {id}
        {frs ? ` · ${frs}` : ""}
      </span>
    </div>
  );
}

export interface ScreenProps {
  /** Screen identifier from the UX architecture inventory, e.g. "L-01". */
  id: string;
  frs?: string;
  workspace?: string;
  title: string;
  lead?: string;
  actions?: Action[];
  /** Page width: default content width, a narrow form or prose column, or full width for workspaces. */
  width?: "form" | "prose" | "full";
  /** Sits under the header, above the content (for example the cohort sub-navigation). */
  nav?: ReactNode;
  /** Secondary column from 1024px (history, how you were told, related items). */
  aside?: ReactNode;
  asideLabel?: string;
  children?: ReactNode;
}

export function Screen({
  id,
  frs,
  workspace,
  title,
  lead,
  actions,
  width,
  nav,
  aside,
  asideLabel,
  children,
}: ScreenProps) {
  return (
    <div className={width ? `page page--${width}` : "page"}>
      <header className="page-header">
        {workspace ? <p className="page-header__workspace">{workspace}</p> : null}
        <h1 className="page-header__title">{title}</h1>
        {lead ? <p className="page-header__lead">{lead}</p> : null}
        <ScreenMeta frs={frs} id={id} />
        {actions?.length ? <Actions actions={actions} className="page-header__actions" /> : null}
      </header>
      {nav ? <div className="u-mb-4">{nav}</div> : null}
      {aside ? (
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">{children}</div>
          <aside aria-label={asideLabel ?? "Related"} className="page-layout__aside stack">
            {aside}
          </aside>
        </div>
      ) : (
        <div className="stack stack--lg">{children}</div>
      )}
    </div>
  );
}

export interface BlockProps {
  /** A real section heading, when the finished screen has one here. */
  heading?: string;
  /** What goes in this block. */
  label: string;
  /** What it will show, in the words of the UX specification. */
  detail?: string;
  size?: "sm" | "md" | "lg" | "xl";
  /** A link to the skeleton of the screen this block leads to. */
  example?: { label: string; href: string };
}

export function Block({ heading, label, detail, size = "md", example }: BlockProps) {
  const block = (
    <div className={size === "md" ? "skeleton-block" : `skeleton-block skeleton-block--${size}`}>
      <p className="skeleton-block__label">{label}</p>
      {detail ? <p className="skeleton-block__detail">{detail}</p> : null}
      {example ? (
        <Link className="skeleton-block__example" href={example.href}>
          {example.label}
        </Link>
      ) : null}
    </div>
  );
  if (!heading) return block;
  return (
    <section>
      <div className="section__header">
        <h2 className="text-heading">{heading}</h2>
      </div>
      {block}
    </section>
  );
}

/** Blocks side by side from 768px (two columns) and 1280px (three or four). */
export function Blocks({ columns = 2, children }: { columns?: 2 | 3 | 4; children: ReactNode }) {
  return <div className={`grid grid--${columns}`}>{children}</div>;
}

export type FieldType =
  | "text"
  | "email"
  | "password"
  | "search"
  | "number"
  | "date"
  | "datetime-local"
  | "url"
  | "file"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio";

export interface FieldSpec {
  label: string;
  type?: FieldType;
  help?: string;
  /** Choices for radio (shown as choice cards) and select. */
  options?: string[];
  optional?: boolean;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function Field({ field, prefix }: { field: FieldSpec; prefix: string }) {
  const id = `${prefix}-${slug(field.label)}`;
  const type = field.type ?? "text";
  const help = field.help ? <p className="field__help">{field.help}</p> : null;
  const optional = field.optional ? <span className="field__optional"> (optional)</span> : null;

  if (type === "checkbox") {
    return (
      <label className="check">
        <input className="check__input" type="checkbox" />
        <span className="check__label">{field.label}</span>
      </label>
    );
  }
  if (type === "radio") {
    return (
      <fieldset className="fieldset">
        <legend className="fieldset__legend">{field.label}</legend>
        {help}
        <div className="choice-group choice-group--2">
          {(field.options ?? []).map((option) => (
            <label className="choice" key={option}>
              <input className="choice__input" name={id} type="radio" />
              <span className="choice__title">{option}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {field.label}
        {optional}
      </label>
      {help}
      {type === "textarea" ? (
        <textarea className="textarea" id={id} />
      ) : type === "select" ? (
        <span className="select">
          <select defaultValue="" id={id}>
            <option disabled value="">
              Choose
            </option>
            {(field.options ?? []).map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </span>
      ) : (
        <input className="input" id={id} type={type} />
      )}
    </div>
  );
}

/** A form with its real field labels and no values. Its actions are disabled until the feature is built. */
export function Form({
  heading,
  fields,
  actions,
  prefix,
  bare,
}: {
  heading?: string;
  fields: FieldSpec[];
  actions?: Action[];
  /** Keeps field ids unique when a screen has more than one form. */
  prefix?: string;
  /** No card around the fields, for forms that already sit in a card (the auth shell). */
  bare?: boolean;
}) {
  const content = (
    <div className={bare ? "stack" : "card__body stack"}>
      {fields.map((field) => (
        <Field field={field} key={field.label} prefix={prefix ?? slug(heading ?? "form")} />
      ))}
      {actions?.length ? <Actions actions={actions} className="cluster" /> : null}
    </div>
  );
  const form = bare ? content : <div className="card">{content}</div>;
  if (!heading) return form;
  return (
    <section>
      <div className="section__header">
        <h2 className="text-heading">{heading}</h2>
      </div>
      {form}
    </section>
  );
}

/**
 * Two-pane assessment workspace (marking, moderation, appeal review): evidence on the left, a panel on the right
 * from 1280px, and a sticky decision bar. Below 1280px the panes stack.
 */
export function Workspace({
  evidence,
  panel,
  decision,
}: {
  evidence: ReactNode;
  panel: ReactNode;
  decision: { summary: string; actions: Action[] };
}) {
  return (
    <>
      <div className="workspace">
        <div className="workspace__evidence">{evidence}</div>
        <div className="workspace__panel">{panel}</div>
      </div>
      <div className="decision-bar">
        <p className="decision-bar__summary">{decision.summary}</p>
        <Actions actions={decision.actions} className="decision-bar__actions" />
        {/* Phones: one button that will open the decision sheet. */}
        <button className="btn btn--primary decision-bar__open" disabled type="button">
          {typeof decision.actions[0] === "string" ? decision.actions[0] : decision.actions[0].label}
        </button>
      </div>
    </>
  );
}

/** Sign-in and account recovery screens: a heading and content inside the auth shell's card. */
export function AuthScreen({
  id,
  frs,
  title,
  children,
}: {
  id: string;
  frs?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="stack">
      <h1 className="text-title">{title}</h1>
      <ScreenMeta frs={frs} id={id} />
      {children}
    </div>
  );
}
