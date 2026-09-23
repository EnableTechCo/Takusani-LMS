import { csvCell, INTAKE_COLUMNS } from "@/modules/identity/intake";
import { getImportBatch, getImportRows } from "@/modules/identity/import-queries";

export const dynamic = "force-dynamic";

// "Download problem rows (CSV)" (flow G, step 4): the rows with a problem, in the template's columns plus a problem
// column, to fix and upload on their own. The database returns nothing to anyone but an administrator.
export async function GET(_: Request, { params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;
  const batch = await getImportBatch(batchId);
  if (!batch) return new Response("Not found", { status: 404 });
  const rows = await getImportRows(batchId, "problem");
  const lines = [
    [...INTAKE_COLUMNS, "problem", "row_in_original_file"].join(","),
    ...rows.map((row) =>
      [row.full_name ?? "", row.email ?? "", row.learner_number ?? "", row.problem ?? "", String(row.row_number)]
        .map(csvCell)
        .join(","),
    ),
  ];
  const name = batch.file_name.replace(/\.csv$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-");
  return new Response(`${lines.join("\r\n")}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}-problems.csv"`,
      "cache-control": "no-store",
    },
  });
}
