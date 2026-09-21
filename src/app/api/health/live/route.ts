import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Liveness: the process is running. No dependencies are checked (LMS-api-design.md "Operational routes").
export function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  return NextResponse.json(
    { status: "ok", request_id: requestId },
    { headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}
