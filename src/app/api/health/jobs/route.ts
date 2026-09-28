import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http/error-response";
import { createWorkerClient } from "@/lib/supabase/admin";
import { jobsStatus, type JobHealthRow } from "@/modules/audit/jobs-health";

export const dynamic = "force-dynamic";

// Scheduled database jobs, for the uptime monitor (S3-10, ADR-025). 200 while every recurring job is scheduled and
// has succeeded within its heartbeat; 503 when any has not, naming it. Job names, ages and counts only.
export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  let rows: JobHealthRow[] | undefined;
  try {
    const { data, error } = await createWorkerClient().rpc("scheduled_job_health");
    if (error) throw new Error(error.message);
    rows = (data ?? undefined) as JobHealthRow[] | undefined;
  } catch {
    rows = undefined;
  }
  if (!rows) {
    return errorResponse(
      503,
      { code: "dependency_unavailable", message: "Job health could not be read.", retryable: true },
      requestId,
    );
  }

  const { overdue, jobs } = jobsStatus(rows, new Date());
  const stale = overdue.length > 0;
  return NextResponse.json(
    { status: stale ? "stale" : "ok", overdue, jobs, request_id: requestId },
    { status: stale ? 503 : 200, headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}
