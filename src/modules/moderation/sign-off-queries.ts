import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/modules/programmes/rules";
import type { Blocker } from "./sign-off-rules";

/** M-04: everything the sign-off page shows, or null when the cycle is not the moderator's or is not frozen. */
export const getSignOff = cache(async (cycleId: string) => {
  if (!isUuid(cycleId)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_sign_off", { p_cycle_id: cycleId });
  if (error) throw new Error(`api.get_sign_off failed: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  return {
    ...row,
    blockers: (row.blockers ?? []) as unknown as Blocker[],
    other_signers: (row.other_signers ?? []) as unknown as string[],
  };
});
