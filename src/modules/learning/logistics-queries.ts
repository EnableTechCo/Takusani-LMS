import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// C-11 (FR-705 to FR-707): only in-person sessions in cohorts the coordinator covers.

export async function listSessionLogistics() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_session_logistics");
  if (error) throw new Error(`api.list_session_logistics failed: ${error.message}`);
  return data ?? [];
}

/** One session's logistics, or null when it is not in a cohort the coordinator covers. */
export async function getSessionLogistics(sessionId: string) {
  if (!z.string().uuid().safeParse(sessionId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_session_logistics", { p_session_id: sessionId });
  if (error) throw new Error(`api.get_session_logistics failed: ${error.message}`);
  return data?.[0] ?? null;
}
