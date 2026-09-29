"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { ARCHIVE_REFUSALS, blockerLines, type ArchivalBlockers } from "./archival-rules";

// Archiving a cohort (X-10; FR-111). The database checks every condition again under the cohort's lock.

export async function archiveCohort(cohortId: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_cohort", { p_cohort_id: cohortId });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    const reasons =
      status === "blocked" && row?.blockers ? blockerLines(row.blockers as unknown as ArchivalBlockers) : [];
    return { message: [ARCHIVE_REFUSALS[status] ?? ARCHIVE_REFUSALS.error, ...reasons].join(" ") };
  }
  revalidatePath("/admin/cohorts");
  revalidatePath(`/coordinate/cohorts/${cohortId}`, "layout");
  redirect(`/admin/cohorts?archived=${cohortId}`);
}
