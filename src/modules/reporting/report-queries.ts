import "server-only";
import { createClient } from "@/lib/supabase/server";
import { reportColumns, type ReportScope, type ReportType } from "./report-rules";

// Programme reports (C-13; FR-708). The database runs each report under the signed-in coordinator's scope.

export async function listReportTypes(): Promise<ReportType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_report_types");
  if (error) throw new Error(`api.list_report_types failed: ${error.message}`);
  return (data ?? []).map((row) => ({ ...row, columns: reportColumns(row.columns) }));
}

export async function runReport(type: string, scope: ReportScope) {
  if (!scope.programmeId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("run_report", {
    p_type: type,
    p_programme_id: scope.programmeId,
    p_cohort_id: scope.cohortId ?? undefined,
    p_from: scope.from ?? undefined,
    p_to: scope.to ?? undefined,
  });
  if (error) throw new Error(`api.run_report failed: ${error.message}`);
  const row = data?.[0];
  return row
    ? {
        status: row.status,
        rows: (row.rows ?? []) as Record<string, unknown>[],
        total: row.total ?? 0,
        truncated: row.truncated ?? false,
      }
    : null;
}

export async function listMyReportExports() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_report_exports");
  if (error) throw new Error(`api.list_my_report_exports failed: ${error.message}`);
  return data ?? [];
}

export async function downloadReportExport(exportId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("download_report_export", { p_export_id: exportId });
  if (error) throw new Error(`api.download_report_export failed: ${error.message}`);
  return data?.[0] ?? null;
}
