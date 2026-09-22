import Link from "next/link";
import type { ReactNode } from "react";
import { buttonClass, iconClass, type ButtonLook } from "./button-class";
import { cx } from "./cx";
import { Icon, type IconName } from "./icons";

/** Links (design system 4.2). Rendered on the server; they need no JavaScript. */

const EXTERNAL = /^(https?:|mailto:)/;

/** A link that looks like a button: navigation, for example "New account". */
export function ButtonLink({
  href,
  variant,
  size,
  block,
  icon,
  children,
}: ButtonLook & { href: string; children: ReactNode }) {
  return (
    <Link className={buttonClass({ variant, size, block })} href={href}>
      {icon ? <Icon className={iconClass(size)} name={icon} /> : null}
      {children}
    </Link>
  );
}

/**
 * A text link. Always underlined: colour is never the only cue. `quiet` inherits the text colour; `standalone` is a
 * link on its own line with an icon. `external` names the service it opens, said in hidden text, for example
 * "opens Microsoft Teams".
 */
export function TextLink({
  href,
  children,
  quiet,
  standalone,
  icon,
  external,
}: {
  href: string;
  children: ReactNode;
  quiet?: boolean;
  standalone?: boolean;
  icon?: IconName;
  external?: string;
}) {
  const className = cx("link", quiet && "link--quiet", standalone && "link--standalone");
  const content = (
    <>
      {children}
      {icon || external ? <Icon className="icon icon--sm" name={icon ?? "external"} /> : null}
      {external ? <span className="u-visually-hidden"> ({external})</span> : null}
    </>
  );
  return EXTERNAL.test(href) ? (
    <a className={className} href={href}>
      {content}
    </a>
  ) : (
    <Link className={className} href={href}>
      {content}
    </Link>
  );
}

/**
 * Why an action cannot be taken yet, as visible text beside the disabled control, never a tooltip. Give the control
 * `aria-describedby` with this id.
 */
export function BlockedReason({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p className="blocked-reason" id={id}>
      <Icon className="icon icon--sm" name="info" />
      {children}
    </p>
  );
}
