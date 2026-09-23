/**
 * Reading an intake file (S2-01, FR-103; flow G, E1). Only the file's shape is checked here: that it is a CSV with the
 * columns we need. Every row's content is checked in the database (api.create_import_batch), so the rules for a
 * learner live in one place.
 */

/** Under Next.js's 1 MB limit on a server action's body, with room for the form. 5,000 learners is about 400 KB. */
export const MAX_INTAKE_BYTES = 900 * 1024;
export const MAX_INTAKE_ROWS = 5000;

/** The template's header, in the order the template gives it. */
export const INTAKE_COLUMNS = ["full_name", "email", "learner_number"] as const;
const REQUIRED = ["full_name", "email"] as const;

/** Header spellings people use, mapped to the column they mean. */
const ALIASES: Record<string, (typeof INTAKE_COLUMNS)[number]> = {
  full_name: "full_name",
  name: "full_name",
  fullname: "full_name",
  learner_name: "full_name",
  email: "email",
  email_address: "email",
  e_mail: "email",
  learner_number: "learner_number",
  learner_no: "learner_number",
  student_number: "learner_number",
};

// A type alias, not an interface, so it can be sent as JSON to the database as it is.
export type IntakeRow = {
  /** The line in the file, counting the header as row 1, so a person can find it. */
  row: number;
  full_name: string;
  email: string;
  learner_number: string;
};

export type IntakeRead =
  | { ok: true; rows: IntakeRow[] }
  | { ok: false; problem: "empty" | "missing_columns" | "too_many_rows" | "unreadable"; detail?: string };

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

const headerKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** The rows of an intake file, or why the file cannot be read at all. Blank lines are skipped. */
export function readIntake(text: string): IntakeRead {
  const table = parseCsv(text);
  if (!table) return { ok: false, problem: "unreadable", detail: "A quoted value is never closed." };
  const lines = table
    .map((cells, index) => ({ cells, row: index + 1 }))
    .filter(({ cells }) => cells.some((cell) => cell.trim() !== ""));
  if (lines.length === 0) return { ok: false, problem: "empty" };

  const header = lines[0].cells.map((cell) => ALIASES[headerKey(cell)] ?? null);
  const missing = REQUIRED.filter((column) => !header.includes(column));
  if (missing.length > 0) return { ok: false, problem: "missing_columns", detail: missing.join(", ") };

  const body = lines.slice(1);
  if (body.length === 0) return { ok: false, problem: "empty" };
  if (body.length > MAX_INTAKE_ROWS) return { ok: false, problem: "too_many_rows", detail: String(body.length) };

  const at = (cells: string[], column: (typeof INTAKE_COLUMNS)[number]) => {
    const index = header.indexOf(column);
    return index === -1 ? "" : (cells[index] ?? "").trim();
  };
  return {
    ok: true,
    rows: body.map(({ cells, row }) => ({
      row,
      full_name: at(cells, "full_name"),
      email: at(cells, "email"),
      learner_number: at(cells, "learner_number"),
    })),
  };
}

/** A CSV cell, quoted when it must be. Cells that a spreadsheet would run as a formula are prefixed with a quote. */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
