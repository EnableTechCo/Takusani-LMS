import "server-only";
import { after } from "next/server";
import { getAppUrl, getEmailSettings } from "@/config/env";
import { createWorkerClient } from "@/lib/supabase/admin";
import { emailSender } from "./email";
import { deliverNotifications, type DeliverySummary } from "./worker";

/** One run of the delivery worker with this deployment's settings. */
export async function runDeliveryWorker(): Promise<DeliverySummary> {
  return deliverNotifications({
    client: createWorkerClient(),
    sender: emailSender(getEmailSettings()),
    appUrl: getAppUrl(),
  });
}

/**
 * After the response is sent, deliver what a commit has just queued, so the email does not wait for the schedule.
 * Best effort: if it fails, the scheduled run delivers it, and the alert watches the oldest undelivered row.
 */
export function deliverSoon(): void {
  after(async () => {
    try {
      await runDeliveryWorker();
    } catch (error) {
      console.error("notification delivery after commit failed; the scheduled run will retry", error);
    }
  });
}
