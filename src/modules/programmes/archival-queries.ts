import "server-only";
import { createClient } from "@/lib/supabase/server";

// Cohort archival (X-10; FR-111). Administrators only: the database returns nothing to anyone else.

export async function listCohortArchival() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_cohort_archival");
  if (error) throw new Error(`api.list_cohort_archival failed: ${error.message}`);
  return data ?? [];
}
