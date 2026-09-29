"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { REPORT_REFUSALS, parseScope } from "./report-rules";

// Exports (C-13; R-20): the request is recorded and the page returns at once; the database builds the CSV in the
// background and tells the requester when it is ready.

export async function requestReportExport(type: string, _: FormState, form: FormData): Promise<FormState> {
  const scope = parseScope(Object.fromEntries([...form.entries()].map(([key, value]) => [key, String(value)])));
  if (!scope.programmeId) return { message: REPORT_REFUSALS.not_found };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_report_export", {
    p_type: type,
    p_programme_id: scope.programmeId,
    p_cohort_id: scope.cohortId ?? undefined,
    p_from: scope.from ?? undefined,
    p_to: scope.to ?? undefined,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") return { message: REPORT_REFUSALS[status] ?? REPORT_REFUSALS.error };
  revalidatePath("/coordinate/reports");
  redirect("/coordinate/reports?exported=1#exports");
}
