"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button-class";
import {
  ACTIVITY_KEY,
  formatCountdown,
  idlePhase,
  latestActivity,
  SIGNED_OUT_KEY,
  signOutPath,
} from "@/modules/identity/idle";

/**
 * Signing out after inactivity, with a warning first (A11Y-07; WCAG 2.2.1; UX architecture 11.1). Two minutes before
 * the limit an alert dialog asks whether to stay signed in, with that choice focused; Escape chooses it too, and it can
 * be chosen as often as needed. At the limit the session ends and the sign-in page says why; drafts are saved on the
 * server, so nothing is lost.
 *
 * Activity in any tab counts: tabs share the last activity through storage, and a tab that signs out tells the others.
 * A playing video counts as activity, and an exam page keeps every tab active (ActivityBeacon).
 */

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;
/** Other tabs learn of this tab's activity at most this often; the warning comes long before it matters. */
const SHARE_EVERY_MS = 15_000;

function readShared(): string | null {
  try {
    return window.localStorage.getItem(ACTIVITY_KEY);
  } catch {
    return null;
  }
}

function writeShared(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private windows, strict settings). This tab still keeps its own time.
  }
}

function mediaPlaying(): boolean {
  return Array.from(document.querySelectorAll<HTMLMediaElement>("video, audio")).some(
    (media) => !media.paused && !media.ended,
  );
}

export function IdleSignOut({ idleMinutes }: { idleMinutes: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const lastActivity = useRef(0);
  const lastShared = useRef(0);
  const signingOut = useRef(false);
  const [msLeft, setMsLeft] = useState<number | null>(null);
  const warned = msLeft !== null;
  const warnedRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  const record = useCallback((at: number, share: boolean) => {
    lastActivity.current = at;
    if (share || at - lastShared.current >= SHARE_EVERY_MS) {
      lastShared.current = at;
      writeShared(ACTIVITY_KEY, String(at));
    }
  }, []);

  const signOut = useCallback(() => {
    if (signingOut.current) return;
    signingOut.current = true;
    writeShared(SIGNED_OUT_KEY, String(Date.now()));
    window.location.assign(signOutPath(window.location.pathname + window.location.search));
  }, []);

  const staySignedIn = useCallback(() => {
    record(Date.now(), true);
    setMsLeft(null);
  }, [record]);

  // Activity, the clock, and the other tabs.
  useEffect(() => {
    if (!(idleMinutes > 0)) return;
    record(Date.now(), true);

    // Once the warning is showing, only its buttons (or Escape) keep the session: a stray key or scroll must not
    // silently dismiss a question a screen reader user may still be hearing.
    const onActivity = () => {
      if (!warnedRef.current) record(Date.now(), false);
    };
    const tick = () => {
      if (mediaPlaying()) record(Date.now(), false);
      const phase = idlePhase(latestActivity(lastActivity.current, readShared()), Date.now(), idleMinutes);
      if (phase.phase === "expired") signOut();
      else setMsLeft(phase.phase === "warning" ? phase.msLeft : null);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SIGNED_OUT_KEY) signOut();
    };

    ACTIVITY_EVENTS.forEach((type) => window.addEventListener(type, onActivity, { capture: true, passive: true }));
    window.addEventListener("storage", onStorage);
    const timer = window.setInterval(tick, 1000);
    return () => {
      ACTIVITY_EVENTS.forEach((type) => window.removeEventListener(type, onActivity, { capture: true }));
      window.removeEventListener("storage", onStorage);
      window.clearInterval(timer);
    };
  }, [idleMinutes, record, signOut]);

  // Open and close the dialog with the warning; focus starts on "Stay signed in" and returns where it was.
  useEffect(() => {
    warnedRef.current = warned;
    const node = dialog.current;
    if (!node) return;
    if (warned && !node.open) {
      opener.current = document.activeElement as HTMLElement | null;
      node.showModal();
      stay.current?.focus();
    } else if (!warned && node.open) {
      node.close();
      if (opener.current?.isConnected) opener.current.focus();
      opener.current = null;
    }
  }, [warned]);

  if (!(idleMinutes > 0)) return null;
  return (
    <dialog
      aria-describedby={bodyId}
      aria-labelledby={titleId}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        staySignedIn();
      }}
      ref={dialog}
      role="alertdialog"
    >
      <div className="modal__header">
        <h2 className="modal__title" id={titleId}>
          Do you want to stay signed in?
        </h2>
      </div>
      <div className="modal__body stack">
        <p id={bodyId}>
          You have not done anything for a while, so you will be signed out in{" "}
          {msLeft !== null && msLeft > 60_000 ? "2 minutes" : "less than a minute"}. Your saved work is kept.
        </p>
        {/* The countdown is for sighted readers; it would interrupt a screen reader every second. */}
        <p aria-hidden="true" className="text-small text-muted">
          Signing out in <span className="mono">{formatCountdown(msLeft ?? 0)}</span>
        </p>
      </div>
      <div className="modal__footer">
        <form action="/auth/sign-out" method="post">
          <button className={buttonClass({ variant: "secondary" })} type="submit">
            Sign out now
          </button>
        </form>
        <button className={buttonClass({ variant: "primary" })} onClick={staySignedIn} ref={stay} type="button">
          Stay signed in
        </button>
      </div>
    </dialog>
  );
}

/**
 * On exam pages: keeps the shared last activity fresh while the page is open, so a quiet tab elsewhere never signs
 * the learner out in the middle of an exam (the exam shell has no inactivity limit of its own).
 */
export function ActivityBeacon() {
  useEffect(() => {
    const beat = () => writeShared(ACTIVITY_KEY, String(Date.now()));
    beat();
    const timer = window.setInterval(beat, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return null;
}
