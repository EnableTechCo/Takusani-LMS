import { describe, expect, it } from "vitest";
import { adminLead, importsInProgress, lockedAccounts, scheduledChanges } from "./admin-overview-rules";

const now = new Date("2026-09-29T08:00:00Z");

describe("lockedAccounts", () => {
  it("keeps locks still in force, names them, most recent first", () => {
    const locks = [
      { profile_id: "a", locked_at: "2026-09-29T07:00:00Z", locked_until: "2026-09-29T07:30:00Z", failures: 5 },
      { profile_id: "b", locked_at: "2026-09-29T07:50:00Z", locked_until: "2026-09-29T08:20:00Z", failures: 5 },
      { profile_id: "c", locked_at: "2026-09-29T07:40:00Z", locked_until: "2026-09-29T08:10:00Z", failures: 6 },
    ];
    const accounts = [{ profile_id: "b", full_name: "Thabo Nkosi", email: "thabo@example.org" }];
    const rows = lockedAccounts(locks, accounts, now);
    expect(rows.map((row) => `${row.profile_id}:${row.full_name}`)).toEqual(["b:Thabo Nkosi", "c:Unknown account"]);
  });
});

describe("importsInProgress", () => {
  it("keeps checked and importing batches, newest first", () => {
    const batch = (over: Record<string, unknown>) => ({
      id: "b",
      reference: "IMP-1",
      file_name: "intake.csv",
      cohort_name: "Intake B",
      state: "validated",
      created_at: "2026-09-20T10:00:00Z",
      total: 40,
      ready: 38,
      problems: 2,
      imported: 0,
      ...over,
    });
    const rows = [
      batch({ id: "old" }),
      batch({ id: "done", state: "completed" }),
      batch({ id: "cancelled", state: "cancelled" }),
      batch({ id: "running", state: "importing", created_at: "2026-09-28T10:00:00Z" }),
    ];
    expect(importsInProgress(rows).map((row) => row.id)).toEqual(["running", "old"]);
  });
});

describe("scheduledChanges", () => {
  it("keeps settings with a change scheduled, soonest first", () => {
    const rows = [
      { key: "a", label: "Appeal window", group_label: "Appeals", scheduled_from: "2026-11-01T00:00:00+02:00" },
      { key: "b", label: "Upload limit", group_label: "Submissions", scheduled_from: null },
      { key: "c", label: "Idle limit", group_label: "Sign-in", scheduled_from: "2026-10-01T00:00:00+02:00" },
    ];
    expect(scheduledChanges(rows).map((row) => row.key)).toEqual(["c", "a"]);
  });
});

describe("adminLead", () => {
  it("says what needs attention in one sentence", () => {
    expect(adminLead({ locked: 0, imports: 0, scheduled: 0 })).toBe("Nothing needs your attention right now.");
    expect(adminLead({ locked: 1, imports: 2, scheduled: 1 })).toBe(
      "1 account is locked, 2 imports are in progress, and 1 configuration change is scheduled.",
    );
  });
});
