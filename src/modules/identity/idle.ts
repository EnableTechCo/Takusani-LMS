/**
 * Signing out after inactivity (A11Y-07; WCAG 2.2.1; UX architecture 11.1). Pure rules, shared by the app shell's
 * warning and its tests. The last activity is shared between tabs through storage, so doing something in one tab
 * keeps every tab signed in, and an exam in progress keeps them all active.
 */

/** The warning comes this long before the limit: at least two minutes' notice (UX architecture 11.1). */
export const WARN_BEFORE_MS = 2 * 60 * 1000;

/** Where tabs share the moment of the last activity, and tell each other that the session ended. */
export const ACTIVITY_KEY = "takusani.last-activity";
export const SIGNED_OUT_KEY = "takusani.signed-out";

export type IdlePhase = { phase: "active" } | { phase: "warning"; msLeft: number } | { phase: "expired" };

/** Where a session stands, given its last activity and the limit in minutes. A limit of 0 or less never expires. */
export function idlePhase(lastActivity: number, now: number, limitMinutes: number): IdlePhase {
  if (!(limitMinutes > 0)) return { phase: "active" };
  const left = lastActivity + limitMinutes * 60 * 1000 - now;
  if (left <= 0) return { phase: "expired" };
  if (left <= WARN_BEFORE_MS) return { phase: "warning", msLeft: left };
  return { phase: "active" };
}

/** The time left as a clock, rounded up to the second: "1:45", "0:09". */
export function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** The later of this tab's activity and the one other tabs recorded; a missing or unreadable value is ignored. */
export function latestActivity(own: number, stored: string | null): number {
  const shared = stored === null ? NaN : Number(stored);
  return Number.isFinite(shared) && shared > own ? shared : own;
}

/** Where to go when the session ends here: sign out, say why, and come back to this page after signing in. */
export function signOutPath(currentPath: string): string {
  const params = new URLSearchParams({ reason: "idle" });
  if (currentPath.startsWith("/") && !currentPath.startsWith("//")) params.set("next", currentPath);
  return `/auth/sign-out?${params.toString()}`;
}
