/**
 * The alert on scheduled database jobs (S3-10; ADR-025; operations, initial alert thresholds: "a missed Supabase Cron
 * heartbeat"). The database says which jobs are overdue: not scheduled, or no success within their heartbeat. This
 * shapes that for the uptime monitor: job names, ages and counts only.
 */
export interface JobHealthRow {
  job_name: string;
  kind: string;
  schedule: string | null;
  heartbeat_within_seconds: number | null;
  scheduled: boolean | null;
  last_run_at: string | null;
  last_status: string | null;
  last_success_at: string | null;
  failures_last_day: number;
  overdue: boolean;
}

export interface JobReport {
  name: string;
  schedule: string | null;
  scheduled: boolean | null;
  last_status: string | null;
  seconds_since_success: number | null;
  heartbeat_within_seconds: number | null;
  failures_last_day: number;
  overdue: boolean;
}

export function jobsStatus(rows: JobHealthRow[], now: Date): { overdue: string[]; jobs: JobReport[] } {
  const jobs = rows.map((row) => ({
    name: row.job_name,
    schedule: row.schedule,
    scheduled: row.scheduled,
    last_status: row.last_status,
    seconds_since_success: row.last_success_at
      ? Math.max(0, Math.floor((now.getTime() - new Date(row.last_success_at).getTime()) / 1000))
      : null,
    heartbeat_within_seconds: row.heartbeat_within_seconds,
    failures_last_day: row.failures_last_day,
    overdue: row.overdue,
  }));
  return { overdue: jobs.filter((job) => job.overdue).map((job) => job.name), jobs };
}
