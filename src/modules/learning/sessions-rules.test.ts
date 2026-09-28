import { describe, expect, it } from "vitest";
import { durationText, renderNotification } from "@/modules/notifications/templates";
import { isTeamsLink, joinWindow } from "./sessions-rules";

describe("isTeamsLink (FR-206)", () => {
  it("accepts the links Teams gives out for a meeting", () => {
    expect(isTeamsLink("https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc%40thread.v2/0?context=%7b%7d")).toBe(
      true,
    );
    expect(isTeamsLink("https://teams.microsoft.com/meet/2345678901?p=abc")).toBe(true);
    expect(isTeamsLink("https://teams.live.com/meet/9876543210")).toBe(true);
    expect(isTeamsLink("  https://teams.live.com/meet/9876543210  ")).toBe(true);
  });

  it("refuses plain http, other services and look-alike domains", () => {
    expect(isTeamsLink("http://teams.microsoft.com/l/meetup-join/x")).toBe(false);
    expect(isTeamsLink("https://zoom.us/j/123")).toBe(false);
    expect(isTeamsLink("https://teams.microsoft.com.evil.example/l/meetup-join/x")).toBe(false);
    expect(isTeamsLink("https://teams.microsoft.com/")).toBe(false);
  });
});

describe("joinWindow (FR-305)", () => {
  const start = "2026-09-29T09:00:00+02:00";

  it("opens ten minutes before the start and closes at the end", () => {
    expect(joinWindow(start, 120, new Date("2026-09-29T08:49:00+02:00"))).toEqual({
      state: "early",
      opensAt: new Date("2026-09-29T08:50:00+02:00"),
    });
    expect(joinWindow(start, 120, new Date("2026-09-29T08:50:00+02:00")).state).toBe("open");
    expect(joinWindow(start, 120, new Date("2026-09-29T10:59:00+02:00")).state).toBe("open");
    expect(joinWindow(start, 120, new Date("2026-09-29T11:00:00+02:00")).state).toBe("ended");
  });
});

describe("session notifications (FR-207)", () => {
  const payload = {
    title: "Session 15: Office administration",
    cohort_name: "2026 Intake B",
    starts_at: "2026-09-29T07:00:00Z",
    duration_minutes: 120,
    mode: "online",
    venue: null,
    cancel_reason: "The facilitator is ill.",
  };

  it("say when, how long and where", () => {
    expect(renderNotification("session_scheduled", 1, payload)).toMatchObject({
      title: "New session: Session 15: Office administration",
      summary: "Tuesday 29 September 2026 at 09:00 (SAST), 2 hours, online in Teams.",
    });
    expect(
      renderNotification("session_changed", 1, {
        ...payload,
        mode: "in_person",
        venue: "Training Room 2",
        duration_minutes: 90,
      }).summary,
    ).toBe("Now Tuesday 29 September 2026 at 09:00 (SAST), 1 hour 30 minutes, at Training Room 2.");
  });

  it("give the reason for a cancellation", () => {
    expect(renderNotification("session_cancelled", 1, payload)).toMatchObject({
      title: "Session cancelled: Session 15: Office administration",
      summary: "It was on Tuesday 29 September 2026 at 09:00 (SAST). The facilitator is ill.",
    });
  });

  it("put lengths in words", () => {
    expect([45, 60, 90, 120, 61].map(durationText)).toEqual([
      "45 minutes",
      "1 hour",
      "1 hour 30 minutes",
      "2 hours",
      "1 hour 1 minute",
    ]);
  });
});
