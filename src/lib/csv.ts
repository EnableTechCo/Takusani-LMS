/** CSV in and out: files people upload (learner intakes, unit lists), and files they open in a spreadsheet. */

/** A CSV cell, quoted when it must be. Cells that a spreadsheet would run as a formula are prefixed with a quote. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A whole file: a header row, then one line per row, CRLF line ends as spreadsheets expect. */
export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const line = (cells: (string | number | null | undefined)[]) =>
    cells.map((cell) => csvCell(cell === null || cell === undefined ? "" : String(cell))).join(",");
  return `${[line(header), ...rows.map(line)].join("\r\n")}\r\n`;
}

/**
 * RFC 4180: fields separated by commas, rows by CRLF or LF; a field in double quotes may hold commas, line breaks and
 * doubled quotes. A byte-order mark at the start is ignored. Returns null when a quoted field never closes.
 */
export function parseCsv(text: string): string[][] | null {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (quoted) return null;
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
