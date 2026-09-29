/**
 * Attendance (FR-209, CR-03): a learner checks in ("I'm here") while a session is on; the facilitator confirms the
 * register from the check-ins. The confirmed register is the record. These rules put the states into words for the
 * learner, the facilitator and the coordinator; the database decides who may do what.
 */

/** Where a session is in its check-in window, as the database reports it (learning.checkin_state). */
export type CheckinState = "not_open" | "open" | "closed" | "confirmed" | "cancelled";

export type AttendanceMark = "present" | "absent";

export const CHECKIN_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  not_found: "This session is not one of yours.",
  session_cancelled: "This session was cancelled, so there is no attendance to mark.",
  not_open: "You can mark yourself present from ten minutes before the session starts.",
  closed: "Check-in has closed for this session. Your facilitator can still mark you present.",
  already_confirmed: "Your facilitator has confirmed the register for this session, so check-in has closed.",
  error: "Your check-in could not be saved. Try again.",
};

export interface LearnerSessionAttendance {
  checkin_state: string;
  checked_in_at: string | null;
  attendance: string | null;
}

export type LearnerAttendanceTone = "positive" | "caution" | "info" | "neutral";

/** The learner's own state for one session, as a status word with its tone. */
export function learnerAttendanceStatus(row: LearnerSessionAttendance): { label: string; tone: LearnerAttendanceTone } {
  if (row.attendance === "present") return { label: "Present", tone: "positive" };
  if (row.attendance === "absent") return { label: "Absent", tone: "caution" };
  if (row.checkin_state === "confirmed") return { label: "Not on the register", tone: "neutral" };
  if (row.checkin_state === "cancelled") return { label: "Cancelled", tone: "neutral" };
  if (row.checked_in_at) return { label: "Checked in, awaiting confirmation", tone: "info" };
  if (row.checkin_state === "open") return { label: "Not checked in", tone: "neutral" };
  if (row.checkin_state === "closed") return { label: "Not checked in", tone: "neutral" };
  return { label: "Not started", tone: "neutral" };
}

export interface AttendanceRate {
  sessions: number;
  present: number;
  /** Whole percent, or null before any register is confirmed. */
  percent: number | null;
}

/** Present at how many of the confirmed sessions. Only confirmed marks count; a check-in on its own is not attendance. */
export function attendanceRate(rows: { attendance: string | null }[]): AttendanceRate {
  const marked = rows.filter((row) => row.attendance === "present" || row.attendance === "absent");
  const present = marked.filter((row) => row.attendance === "present").length;
  return {
    sessions: marked.length,
    present,
    percent: marked.length === 0 ? null : Math.round((present / marked.length) * 100),
  };
}

/** "Present at 8 of 10 sessions (80%)", or what will appear before any register is confirmed. */
export function attendanceText(rate: AttendanceRate, who: "you" | "they" = "you"): string {
  if (rate.percent === null) {
    return who === "you"
      ? "No register has been confirmed yet. Your attendance appears here once your facilitator confirms one."
      : "No register confirmed yet.";
  }
  const sessions = rate.sessions === 1 ? "1 session" : `${rate.sessions} sessions`;
  return `Present at ${rate.present} of ${sessions} (${rate.percent}%)`;
}

/** A learner's row on a cohort's attendance, from the confirmed counts. */
export function learnerRate(row: { sessions: number; present: number }): AttendanceRate {
  return {
    sessions: row.sessions,
    present: row.present,
    percent: row.sessions === 0 ? null : Math.round((row.present / row.sessions) * 100),
  };
}

export interface SessionRegisterCounts {
  state: string;
  register_version: number;
  checkin_state: string;
  audience: number;
  checked_in: number;
  present: number;
  absent: number;
}

/**
 * One session's attendance as the facilitator or coordinator sees it in a list: the confirmed counts, or the
 * check-ins so far and that the register still needs confirming.
 */
export function sessionAttendanceText(session: SessionRegisterCounts): string {
  if (session.state === "cancelled") return "Cancelled, no register";
  if (session.register_version > 0) {
    const total = session.present + session.absent;
    return `${session.present} of ${total} present`;
  }
  if (session.checkin_state === "not_open") return "Check-in opens ten minutes before the start";
  const checked = `${session.checked_in} of ${session.audience} checked in`;
  return session.checkin_state === "closed" ? `${checked}. Register not confirmed` : checked;
}

/** The status word beside a session's attendance in a list. */
export function sessionRegisterTag(
  session: Pick<SessionRegisterCounts, "state" | "register_version" | "checkin_state">,
): { label: string; tone: LearnerAttendanceTone } | null {
  if (session.state === "cancelled") return null;
  if (session.register_version > 0) return { label: "Confirmed", tone: "positive" };
  if (session.checkin_state === "closed") return { label: "To confirm", tone: "caution" };
  if (session.checkin_state === "open") return { label: "Check-in open", tone: "info" };
  return null;
}

/** Sessions that have started and whose register is not confirmed, latest first: the facilitator's to-do. */
export function registersToConfirm<S extends { state: string; register_version: number; starts_at: string }>(
  sessions: S[],
  now: Date,
): S[] {
  return sessions
    .filter(
      (session) =>
        session.state !== "cancelled" &&
        session.register_version === 0 &&
        new Date(session.starts_at).getTime() <= now.getTime(),
    )
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
}
