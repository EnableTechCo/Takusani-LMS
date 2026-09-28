/** Sessions (S2-15; FR-206, FR-207, FR-305): the Teams link check, the join window, and refusals in words. */

/**
 * The links Teams gives out for a meeting, as the database checks them (learning.is_teams_link): work and school
 * accounts (teams.microsoft.com, a meetup-join or meet link) and personal accounts (teams.live.com/meet).
 */
export const TEAMS_LINK = /^https:\/\/teams\.(microsoft\.com\/(l\/meetup-join|meet)\/|live\.com\/meet\/)[^\s<>"]+$/;

export function isTeamsLink(url: string): boolean {
  return url.length <= 2000 && TEAMS_LINK.test(url.trim());
}

/** People can join from this many minutes before the start (UX architecture P0-03, assumption). */
export const JOIN_EARLY_MINUTES = 10;

export type JoinWindow = { state: "early"; opensAt: Date } | { state: "open" } | { state: "ended" };

export function joinWindow(startsAt: string, durationMinutes: number, now: Date): JoinWindow {
  const start = new Date(startsAt).getTime();
  const opensAt = start - JOIN_EARLY_MINUTES * 60_000;
  const endsAt = start + durationMinutes * 60_000;
  if (now.getTime() >= endsAt) return { state: "ended" };
  if (now.getTime() >= opensAt) return { state: "open" };
  return { state: "early", opensAt: new Date(opensAt) };
}

export const DURATIONS = [30, 45, 60, 90, 120, 180, 240, 360, 480] as const;

export const SESSION_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again.",
  forbidden: "You do not set work in this cohort.",
  not_found: "This session no longer exists.",
  cohort_not_found: "Choose a cohort.",
  invalid_title: "Enter a title of up to 200 characters.",
  start_in_past: "Choose a start time from now on.",
  invalid_duration: "Choose how long it lasts.",
  invalid_mode: "Choose online or in person.",
  invalid_teams_link:
    "Paste the Teams meeting link: it starts with https://teams.microsoft.com/l/meetup-join/ or https://teams.live.com/meet/.",
  invalid_venue: "Enter where it takes place.",
  cancelled: "This session was cancelled and can no longer be changed.",
  already_held: "This session has already taken place.",
  stale_version:
    "Someone else changed this session while you were editing. Reload to see their changes; yours were not saved.",
  reason_required: "Say why it is cancelled. The learners are told.",
  already_cancelled: "This session is already cancelled.",
  error: "The session could not be saved. Try again.",
};
