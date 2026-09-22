"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button, IconButton } from "./button";
import { buttonClass, type ButtonVariant } from "./button-class";
import { cx } from "./cx";

/**
 * Dialogs (design system 4.6) on the native <dialog> and showModal(): the rest of the page is inert, Escape closes,
 * Tab stays inside, and focus returns to the button that opened it. On phones an ordinary dialog is a bottom sheet;
 * a consequence dialog stays a centred modal at every size.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function useModal() {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  const show = useCallback(() => {
    opener.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) {
      node.showModal();
      const target = node.querySelector<HTMLElement>("[data-autofocus]") ?? node.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    } else if (!open && node.open) {
      node.close();
    }
    if (!open) {
      opener.current?.focus();
      opener.current = null;
    }
  }, [open]);

  /**
   * Escape closes and Tab stays inside, as in the prototype. Escape is handled here as well as by the browser's own
   * cancel, whose close-watcher rules can skip it (for example a second Escape without a click in between).
   */
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key !== "Tab") return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (item) => item.offsetParent !== null || item === document.activeElement,
    );
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  return { dialog, open, show, close, onKeyDown };
}

export interface DialogProps {
  /** The button that opens the dialog. */
  trigger: { label: string; variant?: ButtonVariant };
  title: string;
  children: ReactNode;
  /** Buttons at the foot. Receives `close`. Buttons stack on phones with the safe action nearest the thumb. */
  footer?: (close: () => void) => ReactNode;
  /** A bottom sheet below 768px, centred above it: the workspace picker, sort and filter, the decision sheet. */
  sheet?: boolean | "full";
  wide?: boolean;
}

/** An ordinary dialog. Clicking the backdrop closes it. */
export function Dialog({ trigger, title, children, footer, sheet, wide }: DialogProps) {
  const { dialog, show, close, onKeyDown } = useModal();
  const titleId = useId();
  return (
    <>
      <Button onClick={show} variant={trigger.variant ?? "secondary"}>
        {trigger.label}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className={cx("modal", sheet && "modal--sheet", sheet === "full" && "modal--full", wide && "modal--wide")}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
        onKeyDown={onKeyDown}
        ref={dialog}
      >
        <div className="modal__header">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <IconButton icon="x" label="Close" onClick={close} />
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer(close)}</div> : null}
      </dialog>
    </>
  );
}

export interface ConsequenceDialogProps {
  trigger: { label: string; variant?: ButtonVariant };
  title: string;
  /**
   * The effect in plain words, with the number of people affected, for example "96 learners in 2026 Intake B will
   * see their results straight away".
   */
  consequence: ReactNode;
  /** Further facts: counts, and the capacity the person acts in ("You are signing off as the moderator"). */
  children?: ReactNode;
  /** A statement the person must tick before the confirm button works. */
  acknowledgement?: string;
  confirmLabel: string;
  cancelLabel: string;
  /**
   * The id of the form the confirm button submits. The dialog closes and the form's action runs; the confirm
   * button's name and value, when given, are submitted with it.
   */
  form?: string;
  name?: string;
  value?: string;
  onConfirm?: () => void;
}

/**
 * For commands that cannot be undone: finalise, freeze and sample, sign off and release, lodge a remark, submit an
 * exam. Only the buttons close it (not the backdrop), focus starts on the safe action, and the confirm button is
 * ink, not red: these are irreversible, not destructive.
 */
export function ConsequenceDialog({
  trigger,
  title,
  consequence,
  children,
  acknowledgement,
  confirmLabel,
  cancelLabel,
  form,
  name,
  value,
  onConfirm,
}: ConsequenceDialogProps) {
  const { dialog, show, close, onKeyDown } = useModal();
  const titleId = useId();
  const ackId = useId();
  const [acknowledged, setAcknowledged] = useState(false);
  const ready = !acknowledgement || acknowledged;
  return (
    <>
      <Button onClick={show} variant={trigger.variant ?? "primary"}>
        {trigger.label}
      </Button>
      <dialog
        aria-labelledby={titleId}
        className="modal"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => setAcknowledged(false)}
        onKeyDown={onKeyDown}
        ref={dialog}
      >
        <div className="modal__header">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
        </div>
        <div className="modal__body">
          <p className="modal__consequence">{consequence}</p>
          {children}
          {acknowledgement ? (
            <label className="check" htmlFor={ackId}>
              <input
                checked={acknowledged}
                className="check__input"
                id={ackId}
                onChange={(event) => setAcknowledged(event.target.checked)}
                type="checkbox"
              />
              <span className="check__label">{acknowledgement}</span>
            </label>
          ) : null}
        </div>
        <div className="modal__footer">
          <button className={buttonClass({ variant: "secondary" })} data-autofocus onClick={close} type="button">
            {cancelLabel}
          </button>
          <button
            className={buttonClass({ variant: "primary" })}
            disabled={!ready}
            form={form}
            name={name}
            onClick={() => {
              onConfirm?.();
              close();
            }}
            type={form ? "submit" : "button"}
            value={value}
          >
            {confirmLabel}
          </button>
        </div>
      </dialog>
    </>
  );
}
