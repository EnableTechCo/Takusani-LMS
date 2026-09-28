import { describe, expect, it } from "vitest";
import { jobsStatus, type JobHealthRow } from "./jobs-health";

const now = new Date("2026-10-05T08:00:00Z");
const notices: JobHealthRow = {
  job_name: "release-scheduled-notices",
  kind: "recurring",
  schedule: "* * * * *",
  heartbeat_within_seconds: 300,
  scheduled: true,
  last_run_at: "2026-10-05T07:59:00Z",
  last_status: "succeeded",
  last_success_at: "2026-10-05T07:59:00Z",
  failures_last_day: 0,
  overdue: false,
};
const once: JobHealthRow = {
  ...notices,
  job_name: "release-notice",
  kind: "one_shot",
  schedule: null,
  heartbeat_within_seconds: null,
  scheduled: null,
  last_success_at: null,
  last_run_at: null,
  last_status: null,
};

describe("jobsStatus", () => {
  it("reports each job with how long since it last succeeded", () => {
    const { overdue, jobs } = jobsStatus([notices, once], now);
    expect(overdue).toEqual([]);
    expect(jobs[0]).toMatchObject({ name: "release-scheduled-notices", seconds_since_success: 60, overdue: false });
    expect(jobs[1]).toMatchObject({ name: "release-notice", seconds_since_success: null, overdue: false });
  });

  it("names the jobs that missed their heartbeat, as the database judged them", () => {
    const late = {
      ...notices,
      last_success_at: "2026-10-05T07:50:00Z",
      last_status: "failed",
      failures_last_day: 9,
      overdue: true,
    };
    const { overdue, jobs } = jobsStatus([late, once], now);
    expect(overdue).toEqual(["release-scheduled-notices"]);
    expect(jobs[0]).toMatchObject({ seconds_since_success: 600, failures_last_day: 9, last_status: "failed" });
  });
});
