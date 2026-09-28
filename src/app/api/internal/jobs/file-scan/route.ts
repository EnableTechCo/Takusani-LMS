import { NextResponse } from "next/server";
import { cronAuthorisation } from "@/lib/http/cron-auth";
import { errorResponse } from "@/lib/http/error-response";
import { runFileScan } from "@/modules/submissions/file-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The file scan (S3-11): authoritative SHA-256 and detected media type for each accepted file. Vercel Cron calls it
// with GET and the cron secret, as the backstop to the scan straight after each upload. Overlapping calls are harmless.
export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const authorisation = cronAuthorisation(request, process.env.CRON_SECRET);
  if (authorisation === "not_configured") {
    return errorResponse(
      503,
      { code: "not_configured", message: "The job secret is not set.", retryable: false },
      requestId,
    );
  }
  if (authorisation === "denied") {
    return errorResponse(
      401,
      { code: "unauthenticated", message: "Not a scheduled call.", retryable: false },
      requestId,
    );
  }

  try {
    const summary = await runFileScan();
    return NextResponse.json(
      { status: "ok", ...summary, request_id: requestId },
      { headers: { "cache-control": "no-store", "x-request-id": requestId } },
    );
  } catch (error) {
    console.error("file scan run failed", { requestId, error });
    return errorResponse(
      503,
      { code: "dependency_unavailable", message: "The scan run could not finish.", retryable: true },
      requestId,
    );
  }
}
