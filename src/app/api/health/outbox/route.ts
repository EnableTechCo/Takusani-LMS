import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http/error-response";
import { createWorkerClient } from "@/lib/supabase/admin";
import { outboxStatus, STALE_AFTER_SECONDS, type OutboxHealth } from "@/modules/notifications/health";

export const dynamic = "force-dynamic";

// Undelivered notifications, for the uptime monitor (S2-10, ADR-025 6). 200 while the oldest undelivered outbox row
// and the oldest queue message are under five minutes old; 503 when either is older. Counts and ages only.
export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  let health: OutboxHealth | undefined;
  try {
    const { data, error } = await createWorkerClient().rpc("notification_outbox_health");
    if (error) throw new Error(error.message);
    health = data?.[0] as OutboxHealth | undefined;
  } catch {
    health = undefined;
  }
  if (!health) {
    return errorResponse(
      503,
      { code: "dependency_unavailable", message: "The outbox could not be read.", retryable: true },
      requestId,
    );
  }

  const { stale, oldestPendingSeconds } = outboxStatus(health, new Date());
  const body = {
    status: stale ? "stale" : "ok",
    pending: health.pending,
    oldest_pending_seconds: oldestPendingSeconds,
    queue_length: health.queue_length,
    oldest_queued_seconds: health.oldest_queued_seconds,
    failed_last_hour: health.failed_last_hour,
    stale_after_seconds: STALE_AFTER_SECONDS,
    request_id: requestId,
  };
  return NextResponse.json(body, {
    status: stale ? 503 : 200,
    headers: { "cache-control": "no-store", "x-request-id": requestId },
  });
}
