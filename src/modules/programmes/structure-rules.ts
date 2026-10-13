import { parseCsv } from "@/lib/csv";

/**
 * Programme structure (FR-701, FR-108; SRS AS-03): qualifications and their units, entered on screen or imported as a
 * unit list. Every unit of a qualification is compulsory, so a qualification's total is the sum of its units' credits.
 * This file reads a unit list's shape and words the database's answers; the database checks each row.
 */

export interface StructureUnit {
  unit_id: string;
  code: string;
  title: string;
  credits: number | null;
  scheduled: { credits: number; effective_from: string } | null;
  in_use: boolean;
}

export interface StructureQualification {
  qualification_id: string;
  code: string;
  title: string;
  units: StructureUnit[];
}

/** A qualification's total: the sum of its units' credits in force (a unit without a value counts as nothing). */
export function qualificationTotal(qualification: StructureQualification): number {
  return qualification.units.reduce((sum, unit) => sum + (unit.credits ?? 0), 0);
}

// ---- Unit list import ---------------------------------------------------------------------------------------------

/** Under Next.js's 1 MB limit on a server action's body. A thousand units is far smaller. */
export const MAX_UNIT_LIST_BYTES = 500 * 1024;
const MAX_UNIT_ROWS = 1000;

/** The template's columns, in its order. */
export const UNIT_LIST_COLUMNS = [
  "qualification_code",
  "qualification_title",
  "unit_code",
  "unit_title",
  "credits",
] as const;
type UnitListColumn = (typeof UNIT_LIST_COLUMNS)[number];
const REQUIRED: UnitListColumn[] = ["qualification_code", "unit_code", "unit_title", "credits"];

/** Header spellings people use, mapped to the column they mean. */
const ALIASES: Record<string, UnitListColumn> = {
  qualification_code: "qualification_code",
  qualification: "qualification_code",
  qualification_id: "qualification_code",
  qualification_title: "qualification_title",
  qualification_name: "qualification_title",
  unit_code: "unit_code",
  unit: "unit_code",
  unit_standard: "unit_code",
  unit_standard_id: "unit_code",
  us_id: "unit_code",
  unit_title: "unit_title",
  unit_name: "unit_title",
  title: "unit_title",
  credits: "credits",
  credit: "credits",
  credit_value: "credits",
};

// A type alias, not an interface, so it can be sent to the database as JSON as it is.
export type UnitListRow = {
  /** The line in the file, counting the header as line 1. */
  row: number;
  qualification_code: string;
  qualification_title: string;
  unit_code: string;
  unit_title: string;
  credits: string;
};

export type UnitListRead =
  | { ok: true; rows: UnitListRow[] }
  | { ok: false; problem: "empty" | "missing_columns" | "too_many_rows" | "unreadable"; detail?: string };

const headerKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

/** The rows of a unit list, or why the file cannot be read at all. Blank lines are skipped. */
export function readUnitList(text: string): UnitListRead {
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
  if (body.length > MAX_UNIT_ROWS) return { ok: false, problem: "too_many_rows", detail: String(body.length) };

  const at = (cells: string[], column: UnitListColumn) => {
    const index = header.indexOf(column);
    return index === -1 ? "" : (cells[index] ?? "").trim();
  };
  return {
    ok: true,
    rows: body.map(({ cells, row }) => ({
      row,
      qualification_code: at(cells, "qualification_code"),
      qualification_title: at(cells, "qualification_title"),
      unit_code: at(cells, "unit_code"),
      unit_title: at(cells, "unit_title"),
      credits: at(cells, "credits"),
    })),
  };
}

export const UNIT_LIST_FILE_PROBLEMS: Record<string, string> = {
  empty: "The file has no units in it.",
  missing_columns: "The file is missing columns:",
  too_many_rows: "The file has more than 1,000 units. Split it and import each part.",
  unreadable: "The file could not be read as CSV.",
  too_big: "The file is larger than 500 KB.",
  no_file: "Choose a CSV file.",
};

/** What is wrong with one line of a unit list, in words. */
export const UNIT_ROW_PROBLEMS: Record<string, string> = {
  unreadable: "The line could not be read.",
  invalid_qualification_code:
    "The qualification code must be 2 to 32 letters, digits or hyphens, starting with a letter or digit.",
  invalid_unit_code: "The unit code must be 2 to 32 letters, digits or hyphens, starting with a letter or digit.",
  invalid_unit_title: "The unit title is missing or longer than 200 characters.",
  invalid_credits: "Credits must be a whole number from 0 to 1000.",
  duplicate_unit: "This unit is already listed above, under the same qualification.",
  qualification_title_required: "This qualification is new, so the line needs its title.",
  qualification_title_differs: "This qualification is listed above with a different title.",
};

export function rowProblemText(problem: { problem: string; first_row?: number }): string {
  const text = UNIT_ROW_PROBLEMS[problem.problem] ?? "This line has a problem.";
  return problem.problem === "duplicate_unit" && problem.first_row ? `${text} (line ${problem.first_row})` : text;
}

/** "3 units to add, in 1 new qualification. 1 unit is already in the programme." */
export function importPreviewText(preview: { newQualifications: number; newUnits: number; skipped: number }): string {
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const add =
    preview.newUnits === 0
      ? "Nothing new to add."
      : `${plural(preview.newUnits, "unit", "units")} to add${
          preview.newQualifications > 0
            ? `, in ${plural(preview.newQualifications, "new qualification", "new qualifications")}`
            : ""
        }.`;
  const skip =
    preview.skipped > 0
      ? ` ${plural(preview.skipped, "unit is", "units are")} already in the programme and will be left as ${preview.skipped === 1 ? "it is" : "they are"}.`
      : "";
  return add + skip;
}

/** After importing: "3 units added, in 1 new qualification. 1 unit was already in the programme and was left as it was." */
export function importDoneText(done: { newQualifications: number; newUnits: number; skipped: number }): string {
  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
  const added =
    done.newUnits === 0
      ? "Nothing new was added."
      : `${plural(done.newUnits, "unit", "units")} added${
          done.newQualifications > 0
            ? `, in ${plural(done.newQualifications, "new qualification", "new qualifications")}`
            : ""
        }.`;
  const kept =
    done.skipped > 0
      ? ` ${plural(done.skipped, "unit was", "units were")} already in the programme and ${done.skipped === 1 ? "was" : "were"} left as ${done.skipped === 1 ? "it was" : "they were"}.`
      : "";
  return added + kept;
}

// ---- Refusals -----------------------------------------------------------------------------------------------------

export const STRUCTURE_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again; nothing was saved.",
  forbidden: "You cannot change this programme's structure.",
  not_found: "That no longer exists. Reload the page.",
  programme_not_found: "That programme no longer exists. Reload the page.",
  qualification_not_found: "That qualification no longer exists. Reload the page.",
  invalid_code: "The code must be 2 to 32 letters, digits or hyphens, starting with a letter or digit.",
  invalid_title: "The title is missing or longer than 200 characters.",
  invalid_credits: "Credits must be a whole number from 0 to 1000.",
  invalid_nqf_level: "The NQF level is from 1 to 10.",
  code_taken: "Another item here already uses that code.",
  unchanged: "Nothing changed.",
  in_use:
    "This unit is already used (by a module, a cohort's credit requirements or a learner's credits), so it cannot be removed. Correct its title instead.",
  has_units: "Remove the qualification's units first.",
  invalid_rows: "The file's lines could not be read. Choose the file again.",
  too_many_rows: "The file has more than 1,000 units. Split it and import each part.",
  error: "The change could not be saved. Try again.",
};

/** Which field a refusal belongs beside. */
export const REFUSAL_FIELD: Record<string, string> = {
  invalid_code: "code",
  code_taken: "code",
  invalid_title: "title",
  invalid_credits: "credits",
  invalid_nqf_level: "nqfLevel",
};
