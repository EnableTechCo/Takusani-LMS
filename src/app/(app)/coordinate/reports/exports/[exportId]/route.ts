import { isUuid } from "@/modules/programmes/rules";
import { downloadReportExport } from "@/modules/reporting/report-queries";

export const dynamic = "force-dynamic";

// A ready report export (C-13; R-20), downloaded by the person who asked for it. The database checks it is theirs,
// ready and not past its 7 days, and audits the download.
export async function GET(_: Request, { params }: { params: Promise<{ exportId: string }> }) {
  const { exportId } = await params;
  if (!isUuid(exportId)) return new Response("Not found", { status: 404 });
  const row = await downloadReportExport(exportId);
  if (!row || row.status === "not_found" || row.status === "unauthenticated")
    return new Response("Not found", { status: 404 });
  if (row.status === "expired") return new Response("This export has expired. Ask for it again.", { status: 410 });
  if (row.status !== "ok" || row.content === null)
    return new Response("This export is not ready yet.", { status: 409 });
  return new Response(row.content, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${(row.filename ?? "report.csv").replace(/[^A-Za-z0-9._-]+/g, "-")}"`,
      "cache-control": "no-store",
    },
  });
}
