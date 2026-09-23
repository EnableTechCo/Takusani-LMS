import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { EmailSender } from "./email";
import { renderEmail, renderNotification } from "./templates";

/**
 * The delivery worker (S2-10, ADR-025). It claims a bounded batch from the queue (each message then hidden from other
 * runs for the visibility timeout), sends each email, and records the outcome; the database archives the message in
 * the same transaction as the outcome. Overlapping or duplicate runs are harmless, and a crash between the send and
 * the record only means the message is shown again and resent under the same idempotency key.
 *
 * Runs from the scheduled job and straight after a commit that notifies, so an email does not wait for the schedule.
 */

type WorkerClient = SupabaseClient<Database, "api">;

export interface DeliverySummary {
  claimed: number;
  accepted: number;
  retried: number;
  failed: number;
  skipped: number;
  /** Outcomes the database did not take (for example a network fault); the message is shown again later. */
  unrecorded: number;
}

/** Wait before the next attempt: 1, 4, 9, 16 minutes, capped at an hour. */
export function retryDelaySeconds(attempt: number): number {
  return Math.min(60 * attempt * attempt, 3600);
}

export async function deliverNotifications({
  client,
  sender,
  appUrl,
  batchSize = 10,
  timeBudgetMs = 20_000,
  now = () => Date.now(),
}: {
  client: WorkerClient;
  sender: EmailSender | null;
  appUrl: string;
  batchSize?: number;
  timeBudgetMs?: number;
  now?: () => number;
}): Promise<DeliverySummary> {
  const summary: DeliverySummary = { claimed: 0, accepted: 0, retried: 0, failed: 0, skipped: 0, unrecorded: 0 };
  const started = now();

  while (now() - started < timeBudgetMs) {
    const { data: batch, error } = await client.rpc("claim_notification_deliveries", {
      p_limit: batchSize,
      p_visibility_seconds: 120,
      p_max_attempts: 5,
    });
    if (error) throw new Error(`api.claim_notification_deliveries failed: ${error.message}`);
    if (!batch || batch.length === 0) break;
    summary.claimed += batch.length;

    for (const row of batch) {
      let settle: {
        p_outcome: "accepted" | "failed" | "skipped" | "retry";
        p_provider?: string;
        p_provider_message_id?: string;
        p_error?: string;
        p_retry_seconds?: number;
      };

      if (!sender) {
        settle = { p_outcome: "skipped", p_error: "email is not set up" };
      } else {
        let result: Awaited<ReturnType<EmailSender["send"]>>;
        try {
          const rendered = renderNotification(
            row.event_type,
            row.template_version,
            row.payload as Record<string, unknown>,
          );
          const email = renderEmail(rendered, { recipientName: row.recipient_name, url: `${appUrl}${row.link}` });
          result = await sender.send({ to: row.address, ...email, idempotencyKey: row.idempotency_key });
        } catch (sendError) {
          // A template that cannot be rendered will not render on the next try either.
          result = { outcome: "failed", error: `could not prepare the email: ${(sendError as Error).message}` };
        }
        settle =
          result.outcome === "accepted"
            ? {
                p_outcome: "accepted",
                p_provider: sender.provider,
                p_provider_message_id: result.providerMessageId ?? undefined,
              }
            : result.outcome === "retry"
              ? { p_outcome: "retry", p_error: result.error, p_retry_seconds: retryDelaySeconds(row.attempt) }
              : { p_outcome: "failed", p_provider: sender.provider, p_error: result.error };
      }

      const { error: settleError } = await client.rpc("settle_notification_delivery", {
        p_msg_id: row.msg_id,
        p_delivery_id: row.delivery_id,
        ...settle,
      });
      if (settleError) {
        summary.unrecorded += 1;
        continue;
      }
      const counted = { accepted: "accepted", retry: "retried", failed: "failed", skipped: "skipped" } as const;
      summary[counted[settle.p_outcome]] += 1;
    }
  }
  return summary;
}
