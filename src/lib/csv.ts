/** CSV for people to open in a spreadsheet: problem rows from an import, a dashboard export. */

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
