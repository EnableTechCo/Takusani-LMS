"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons";

/**
 * Toasts (design system 4.6): low-stakes confirmations only, such as "Reminder sent". Never for errors, saving, or
 * anything that needs action. The polite live region is in the page from the first render, so announcements are
 * reliable. A toast stays 6 seconds and pauses while it is hovered or focused.
 *
 * Built directly rather than on React Aria's toast queue, which is still marked unstable, and which moves toasts
 * into a landmark with its own focus handling that this design does not call for.
 */

export interface ToastMessage {
  title: string;
  body?: string;
  /** A time or a reference, in monospace. */
  meta?: string;
  icon?: IconName;
  /** Milliseconds; 0 keeps it until dismissed. */
  timeout?: number;
}

interface ToastEntry extends ToastMessage {
  id: number;
}

const ToastContext = createContext<{ show: (toast: ToastMessage) => void } | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast needs a ToastProvider above it (the root layout has one).");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);
  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((toast) => toast.id !== id)), []);
  const show = useCallback((toast: ToastMessage) => {
    const id = nextId.current++;
    setToasts((all) => [...all, { ...toast, id }]);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="toast-region" role="status">
        {toasts.map((toast) => (
          <Toast key={toast.id} onDismiss={dismiss} toast={toast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: number) => void }) {
  const { id } = toast;
  const timeout = toast.timeout ?? 6000;
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || timeout <= 0) return;
    const timer = setTimeout(() => onDismiss(id), timeout);
    return () => clearTimeout(timer);
  }, [paused, timeout, onDismiss, id]);
  return (
    <div
      className="toast"
      onBlur={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Icon name={toast.icon ?? "check-circle"} />
      <div>
        <span className="toast__title">{toast.title}</span>
        {toast.body ? <span className="toast__body"> {toast.body}</span> : null}
        {toast.meta ? <span className="toast__meta">{toast.meta}</span> : null}
      </div>
      <button aria-label="Dismiss notification" className="toast__close" onClick={() => onDismiss(id)} type="button">
        <Icon className="icon icon--sm" name="x" />
      </button>
    </div>
  );
}
