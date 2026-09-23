/**
 * The alert on undelivered notifications (ADR-025 6; operations, initial alert thresholds): the oldest undelivered
 * outbox row, or the oldest queue message, older than five minutes. The monitor pages when this stays stale for 15
 * minutes; the route only says whether it is stale now.
 */
export const STALE_AFTER_SECONDS = 300;

export interface OutboxHealth {
  pending: number;
  oldest_pending_at: string | null;
  queue_length: number;
  oldest_queued_seconds: number | null;
  failed_last_hour: number;
}

export function outboxStatus(health: OutboxHealth, now: Date): { stale: boolean; oldestPendingSeconds: number | null } {
  const oldestPendingSeconds = health.oldest_pending_at
    ? Math.max(0, Math.floor((now.getTime() - new Date(health.oldest_pending_at).getTime()) / 1000))
    : null;
  const stale =
    (oldestPendingSeconds ?? 0) > STALE_AFTER_SECONDS || (health.oldest_queued_seconds ?? 0) > STALE_AFTER_SECONDS;
  return { stale, oldestPendingSeconds };
}
