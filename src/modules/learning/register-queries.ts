import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Amendment, RosterEntry } from "./register-rules";

/** F-07: the session, its roster with each learner's mark, and the amendments, newest first. Null if not theirs. */
export async function getRegister(sessionId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_register", { p_session_id: sessionId });
  if (error) throw new Error(`api.get_register failed: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  return {
    ...row,
    roster: (row.roster ?? []) as unknown as RosterEntry[],
    amendments: (row.amendments ?? []) as unknown as Amendment[],
  };
}
