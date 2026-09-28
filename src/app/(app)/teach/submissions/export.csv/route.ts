import { toCsv } from "@/lib/csv";
import { listTaskSubmissionCounts, listTaskSubmissions } from "@/modules/submissions/dashboard-queries";
import { exportRows, filterRows, parseStatusFilter } from "@/modules/submissions/dashboard-rules";

export const dynamic = "force-dynamic";

// Export (FR-211): the current filter of the dashboard as CSV. The database answers only for cohorts the person sets
// work in, so the file holds nothing they could not already see.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const cohortId = params.get("cohort") ?? "";
  const taskId = params.get("task") ?? "";
  const task = (await listTaskSubmissionCounts(cohortId)).find((row) => row.task_id === taskId);
  if (!task) return new Response("Not found", { status: 404 });

  const rows = filterRows(
    await listTaskSubmissions(taskId),
    parseStatusFilter(params.get("status") ?? undefined),
    (params.get("q") ?? "").slice(0, 100),
  );
  const csv = exportRows(rows, task.due_at, new Date());
  const name =
    task.title
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "task";
  return new Response(toCsv(csv.header, csv.rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}-submissions.csv"`,
      "cache-control": "no-store",
    },
  });
}
