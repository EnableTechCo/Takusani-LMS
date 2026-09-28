import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * The configured values the application states to people (S3-09): the appeal window, the reply promised, the largest
 * upload, the largest recording (S3-12) and the late-work policy a new task offers. Read once per request. When nothing
 * comes back (no session), the values the LMS started with.
 */
export const getPublicSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_settings");
  const row = data?.[0];
  return {
    latePolicy: row?.late_policy ?? "accept_and_flag",
    uploadMaxMb: row?.upload_max_mb ?? 25,
    appealWindowDays: row?.appeal_window_days ?? 7,
    appealTurnaroundWorkingDays: row?.appeal_turnaround_working_days ?? 5,
    recordingMaxMb: row?.recording_max_mb ?? 50,
  };
});
