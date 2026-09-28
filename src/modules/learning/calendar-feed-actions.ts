"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";

// The learner's calendar feed link (S3-13, L-08). The database makes the token and keeps only its hash, so the link
// is shown this once, from the action's result, and never stored or logged by the application.

const REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again.",
  forbidden: "The calendar feed is for learners.",
  error: "The link could not be created. Try again.",
};

export async function createFeedLink(): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_calendar_feed_token");
  const row = data?.[0];
  if (error || row?.status !== "ok" || !row.token) {
    return { message: REFUSALS[row?.status ?? "error"] ?? REFUSALS.error };
  }
  revalidatePath("/learn/calendar/subscribe");
  return { done: true, values: { token: row.token } };
}

export async function revokeFeedLink(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("revoke_calendar_feed_token");
  revalidatePath("/learn/calendar/subscribe");
  redirect("/learn/calendar/subscribe?revoked=1");
}
