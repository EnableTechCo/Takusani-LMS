"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { CHECKIN_REFUSALS } from "./attendance-rules";

// "I'm here" (FR-209): the learner marks themselves present at a session. The database decides whether the session
// is theirs and whether check-in is open. A second press is harmless: it returns the time already kept.

export async function markMyAttendance(sessionId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_my_attendance", { p_session_id: sessionId });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok" && status !== "already_marked") {
    return { message: CHECKIN_REFUSALS[status] ?? CHECKIN_REFUSALS.error };
  }
  revalidatePath("/learn");
  revalidatePath("/learn/calendar");
  revalidatePath("/learn/attendance");
  return { done: true, values: { checkedInAt: row!.checked_in_at! } };
}
