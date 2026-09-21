import { NextResponse } from "next/server";

export interface ErrorEnvelope {
  code: string;
  message: string;
  request_id: string;
  retryable: boolean;
}

export function errorResponse(
  status: number,
  error: Omit<ErrorEnvelope, "request_id">,
  requestId = crypto.randomUUID(),
) {
  return NextResponse.json<ErrorEnvelope>(
    { ...error, request_id: requestId },
    { status, headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}
