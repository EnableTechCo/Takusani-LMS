import { INTAKE_COLUMNS } from "@/modules/identity/intake";

// The intake template (flow G, step 1): the header row and one example, so a spreadsheet opens it with the columns.
export function GET() {
  const body = `${INTAKE_COLUMNS.join(",")}\r\nLerato Mokoena,l.mokoena@example.org,KSI-2026-0001\r\n`;
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="learner-import-template.csv"',
      "cache-control": "no-store",
    },
  });
}
