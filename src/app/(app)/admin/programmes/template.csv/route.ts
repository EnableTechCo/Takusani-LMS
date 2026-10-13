import { UNIT_LIST_COLUMNS } from "@/modules/programmes/structure-rules";

// The unit-list template: the header row and two example units, so a spreadsheet opens it with the columns. A new
// qualification needs its title on its first line; later lines may leave it blank.
export function GET() {
  const body = [
    UNIT_LIST_COLUMNS.join(","),
    "Q-CBA4,National Certificate: Business Administration Services,U3,Keep workplace records,12",
    "Q-CBA4,,U4,Handle business correspondence,8",
  ].join("\r\n");
  return new Response(`${body}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="unit-list-template.csv"',
      "cache-control": "no-store",
    },
  });
}
