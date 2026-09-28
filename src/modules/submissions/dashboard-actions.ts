"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { REMINDER_REFUSALS } from "./dashboard-rules";

export interface ReminderState {
  done?: boolean;
  /** The message as typed, kept after a refusal. */
  message?: string;
  error?: string;
  sent?: number;
  skippedSubmitted?: number;
  skippedRecent?: number;
}

/**
 * Sends a reminder to the selected learners (FR-212). The database reminds only those still outstanding, skips anyone
 * reminded in the last hour, and logs each one against the learner.
 */
export async function sendReminder(taskId: string, _: ReminderState, form: FormData): Promise<ReminderState> {
  const learnerIds = form.getAll("learnerId").map(String).filter(Boolean);
  const message = String(form.get("message") ?? "").trim();
  if (!message) return { error: REMINDER_REFUSALS.invalid_message, message };
  if (learnerIds.length === 0) return { error: REMINDER_REFUSALS.no_learners, message };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("send_task_reminder", {
    p_task_id: taskId,
    p_learner_ids: learnerIds,
    p_message: message,
  });
  const row = data?.[0];
  if (error || row?.status !== "ok") {
    return { error: REMINDER_REFUSALS[row?.status ?? "error"] ?? REMINDER_REFUSALS.error, message };
  }
  revalidatePath("/teach/submissions");
  return {
    done: true,
    sent: row.sent ?? 0,
    skippedSubmitted: row.skipped_submitted ?? 0,
    skippedRecent: row.skipped_recent ?? 0,
  };
}
