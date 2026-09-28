import "server-only";
import { createClient } from "@/lib/supabase/server";

// Facilitators see the sessions of cohorts they set work in; learners see their own cohorts'. The database decides.

export async function listSessions() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_sessions");
  if (error) throw new Error(`api.list_sessions failed: ${error.message}`);
  return data;
}

/** One session for the facilitator's page, or null. The list is per facilitator and small, so it is read whole. */
export async function getSession(sessionId: string) {
  return (await listSessions()).find((session) => session.id === sessionId) ?? null;
}

/**
 * The learner's sessions that have not yet ended, or that end after `from` (the month view reads from the start of
 * its month), cancelled ones included (marked), soonest first.
 */
export async function listMySessions(from?: Date) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_sessions", from ? { p_from: from.toISOString() } : {});
  if (error) throw new Error(`api.list_my_sessions failed: ${error.message}`);
  return data;
}

/** L-08: whether the learner has a calendar feed, since when, and when it was last fetched. Never the link. */
export async function getMyCalendarFeed() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_calendar_feed");
  if (error) throw new Error(`api.my_calendar_feed failed: ${error.message}`);
  return data?.[0] ?? null;
}
