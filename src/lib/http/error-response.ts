import { NextResponse } from "next/server";

/**
 * The error envelope from LMS-api-design.md ("Errors and status codes"):
 * { "error": { "code", "message", "request_id", "retryable", "details" } }
 * Codes are lower snake_case and stable, for example "state_conflict", "lease_lost", "separation_of_duties_conflict".
 */
export interface ApiError {
  code: string;
  message: string;
  request_id: string;
  retryable: boolean;
  details?: Record<string, unknown>;
}

export interface ErrorEnvelope {
  error: ApiError;
}

const CODE_PATTERN = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

export function errorResponse(
  status: number,
  error: Omit<ApiError, "request_id">,
  requestId: string = crypto.randomUUID(),
) {
  if (!CODE_PATTERN.test(error.code)) {
    throw new Error(`Error codes must be lower snake_case: ${error.code}`);
  }

  return NextResponse.json<ErrorEnvelope>(
    { error: { ...error, request_id: requestId } },
    { status, headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}
