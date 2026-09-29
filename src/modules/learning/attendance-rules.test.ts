import { describe, expect, it } from "vitest";
import {
  attendanceRate,
  attendanceText,
  learnerAttendanceStatus,
  learnerRate,
  registersToConfirm,
  sessionAttendanceText,
  sessionRegisterTag,
} from "./attendance-rules";

describe("a learner's attendance", () => {
  it("names each session's state, the confirmed mark first", () => {
    expect(learnerAttendanceStatus({ checkin_state: "confirmed", checked_in_at: "x", attendance: "present" })).toEqual({
      label: "Present",
      tone: "positive",
    });
    expect(learnerAttendanceStatus({ checkin_state: "confirmed", checked_in_at: null, attendance: "absent" })).toEqual({
      label: "Absent",
      tone: "caution",
    });
    expect(learnerAttendanceStatus({ checkin_state: "open", checked_in_at: "x", attendance: null })).toEqual({
      label: "Checked in, awaiting confirmation",
      tone: "info",
    });
    expect(learnerAttendanceStatus({ checkin_state: "closed", checked_in_at: null, attendance: null }).label).toBe(
      "Not checked in",
    );
    expect(learnerAttendanceStatus({ checkin_state: "not_open", checked_in_at: null, attendance: null }).label).toBe(
      "Not started",
    );
  });

  it("counts only confirmed marks towards the rate", () => {
    const rate = attendanceRate([
      { attendance: "present" },
      { attendance: "present" },
      { attendance: "absent" },
      { attendance: null },
    ]);
    expect(rate).toEqual({ sessions: 3, present: 2, percent: 67 });
    expect(attendanceText(rate)).toBe("Present at 2 of 3 sessions (67%)");
    expect(attendanceText({ sessions: 1, present: 1, percent: 100 })).toBe("Present at 1 of 1 session (100%)");
    expect(attendanceText(attendanceRate([{ attendance: null }]))).toMatch(/^No register has been confirmed yet/);
    expect(attendanceText(attendanceRate([]), "they")).toBe("No register confirmed yet.");
    expect(learnerRate({ sessions: 0, present: 0 }).percent).toBeNull();
    expect(learnerRate({ sessions: 4, present: 1 }).percent).toBe(25);
  });
});

describe("a session's register in a list", () => {
  const base = { state: "scheduled", audience: 12, checked_in: 5, present: 0, absent: 0 };

  it("says the confirmed counts, or the check-ins so far", () => {
    expect(
      sessionAttendanceText({ ...base, register_version: 2, checkin_state: "confirmed", present: 10, absent: 2 }),
    ).toBe("10 of 12 present");
    expect(sessionAttendanceText({ ...base, register_version: 0, checkin_state: "open" })).toBe("5 of 12 checked in");
    expect(sessionAttendanceText({ ...base, register_version: 0, checkin_state: "closed" })).toBe(
      "5 of 12 checked in. Register not confirmed",
    );
    expect(sessionAttendanceText({ ...base, register_version: 0, checkin_state: "not_open" })).toBe(
      "Check-in opens ten minutes before the start",
    );
    expect(
      sessionAttendanceText({ ...base, state: "cancelled", register_version: 0, checkin_state: "cancelled" }),
    ).toBe("Cancelled, no register");
  });

  it("tags what needs doing", () => {
    expect(sessionRegisterTag({ state: "scheduled", register_version: 1, checkin_state: "confirmed" })).toEqual({
      label: "Confirmed",
      tone: "positive",
    });
    expect(sessionRegisterTag({ state: "scheduled", register_version: 0, checkin_state: "closed" })).toEqual({
      label: "To confirm",
      tone: "caution",
    });
    expect(sessionRegisterTag({ state: "scheduled", register_version: 0, checkin_state: "open" })?.label).toBe(
      "Check-in open",
    );
    expect(sessionRegisterTag({ state: "scheduled", register_version: 0, checkin_state: "not_open" })).toBeNull();
    expect(sessionRegisterTag({ state: "cancelled", register_version: 0, checkin_state: "cancelled" })).toBeNull();
  });

  it("lists the registers still to confirm, latest first", () => {
    const now = new Date("2026-09-29T12:00:00+02:00");
    const sessions = [
      { id: "a", state: "scheduled", register_version: 0, starts_at: "2026-09-28T09:00:00+02:00" },
      { id: "b", state: "scheduled", register_version: 1, starts_at: "2026-09-27T09:00:00+02:00" },
      { id: "c", state: "cancelled", register_version: 0, starts_at: "2026-09-26T09:00:00+02:00" },
      { id: "d", state: "scheduled", register_version: 0, starts_at: "2026-09-29T11:30:00+02:00" },
      { id: "e", state: "scheduled", register_version: 0, starts_at: "2026-09-30T09:00:00+02:00" },
    ];
    expect(registersToConfirm(sessions, now).map((session) => session.id)).toEqual(["d", "a"]);
  });
});
