"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon, type IconName } from "./icons";

/**
 * A disclosure menu on <details> (design system 4.1): the account menu, a page's overflow actions, the context
 * selector. It opens and works before scripts load; with them, a click outside, choosing an item, or Escape closes
 * it, and Escape returns focus to its button.
 */
export function Menu({
  label,
  trigger,
  triggerClassName = "btn btn--ghost btn--icon",
  align = "start",
  children,
}: {
  /** The button's accessible name, for example "More actions" or "Account menu for Lerato Mokoena". */
  label: string;
  /** What the button shows. Defaults to a "more" icon. */
  trigger?: ReactNode;
  triggerClassName?: string;
  align?: "start" | "end";
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const node = details.current;
    if (!node) return;
    const close = (focusButton: boolean) => {
      if (!node.open) return;
      node.open = false;
      if (focusButton) node.querySelector("summary")?.focus();
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!node.contains(target)) close(false);
      else if (target.closest(".menu__item")) close(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && node.open) {
        event.preventDefault();
        close(true);
      }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <details className="menu-wrap" ref={details}>
      <summary aria-label={label} className={triggerClassName}>
        {trigger ?? <Icon name="dots" />}
      </summary>
      <div className={cx("menu", align === "end" && "menu--end")}>{children}</div>
    </details>
  );
}

interface MenuItemContent {
  icon?: IconName;
  children: ReactNode;
  /** A second line, for example a count or a cohort's programme. */
  meta?: ReactNode;
}

function ItemContent({ icon, children, meta }: MenuItemContent) {
  return (
    <>
      {icon ? <Icon name={icon} /> : null}
      <span className="menu__item-text">
        {children}
        {meta ? <span className="menu__item-meta">{meta}</span> : null}
      </span>
    </>
  );
}

/** A menu item that goes somewhere. */
export function MenuLink({ href, current, ...content }: MenuItemContent & { href: string; current?: boolean }) {
  const external = /^(https?:|mailto:)/.test(href);
  const props = { "aria-current": current ? ("true" as const) : undefined, className: "menu__item" };
  return external ? (
    <a {...props} href={href}>
      <ItemContent {...content} />
    </a>
  ) : (
    <Link {...props} href={href}>
      <ItemContent {...content} />
    </Link>
  );
}

/** A menu item that does something. Inside a form, `type="submit"` posts it, as Sign out does. */
export function MenuButton({
  onClick,
  type = "button",
  ...content
}: MenuItemContent & { onClick?: () => void; type?: "button" | "submit" }) {
  return (
    <button className="menu__item" onClick={onClick} type={type}>
      <ItemContent {...content} />
    </button>
  );
}

export function MenuSection({ children }: { children: ReactNode }) {
  return <div className="menu__section">{children}</div>;
}

export function MenuDivider() {
  return <div className="menu__divider" role="separator" />;
}
