import { describe, expect, it } from "vitest";
import { emailLine, groupByDay, notificationText, parseCategory, type EmailEvidence } from "./centre-rules";

const email: EmailEvidence = {
  state: "pending",
  address: "learner@takusani.test",
  created_at: "2026-09-22T12:05:00Z",
  accepted_at: null,
  delivered_at: null,
  failed_at: null,
};

describe("emailLine", () => {
  it("says what happened to the email, in words, with the time that goes with it", () => {
    expect(emailLine(email)).toEqual({
      text: "Email to learner@takusani.test: sending",
      at: email.created_at,
      failed: false,
    });
    expect(emailLine({ ...email, state: "accepted", accepted_at: "2026-09-22T12:06:00Z" })).toEqual({
      text: "Email to learner@takusani.test: sent",
      at: "2026-09-22T12:06:00Z",
      failed: false,
    });
    expect(emailLine({ ...email, state: "failed", failed_at: "2026-09-22T12:07:00Z" })).toEqual({
      text: "Email could not be delivered",
      at: "2026-09-22T12:07:00Z",
      failed: true,
    });
    expect(emailLine({ ...email, state: "skipped", address: null })).toEqual({
      text: "Email was not sent",
      at: null,
      failed: false,
    });
  });
});

describe("groupByDay", () => {
  const now = new Date("2026-09-23T10:00:00+02:00");

  it("groups newest-first rows by South African day, naming today and yesterday", () => {
    const groups = groupByDay(
      [
        { id: "a", created_at: "2026-09-23T08:10:00+02:00" },
        { id: "b", created_at: "2026-09-23T07:00:00+02:00" },
        // 23:30 SAST on the 22nd is still the 22nd, although it is 21:30 UTC.
        { id: "c", created_at: "2026-09-22T21:30:00Z" },
        { id: "d", created_at: "2026-09-14T15:20:00+02:00" },
      ],
      now,
    );
    expect(groups.map((group) => [group.heading, group.items.map((item) => item.id)])).toEqual([
      ["Today, Wednesday 23 September 2026", ["a", "b"]],
      ["Yesterday, Tuesday 22 September 2026", ["c"]],
      ["Monday 14 September 2026", ["d"]],
    ]);
  });
});

describe("notificationText", () => {
  it("uses the template's title and summary", () => {
    expect(
      notificationText("task_published", 1, {
        title: "Task 4",
        cohort_name: "2026 Intake B",
        due_at: "2026-10-02T15:00:00Z",
      }),
    ).toEqual({ title: "New task: Task 4", summary: "Due Friday 2 October 2026 at 17:00 (SAST)." });
  });

  it("still shows a row when a payload cannot be read", () => {
    expect(notificationText("task_published", 1, {})).toEqual({ title: "Notification", summary: null });
  });
});

describe("parseCategory", () => {
  it("accepts the known filters and falls back to all", () => {
    expect(parseCategory("results")).toBe("results");
    expect(parseCategory("deadlines")).toBe("deadlines");
    expect(parseCategory("appeals")).toBe("all");
    expect(parseCategory(undefined)).toBe("all");
  });
});
