import { NextResponse } from "next/server";
import { checkReadiness } from "@/lib/health/readiness";
import { errorResponse } from "@/lib/http/error-response";

export const dynamic = "force-dynamic";

// Readiness: required configuration is present and a bounded database probe succeeds (LMS-api-design.md).
export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const result = await checkReadiness();

  if (!result.ok) {
    return errorResponse(503, { code: "dependency_unavailable", message: "The service is not ready.", retryable: true, details: { checks: result.checks } }, requestId);
  }

  return NextResponse.json(
    { status: "ok", checks: result.checks, request_id: requestId },
    { headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}
