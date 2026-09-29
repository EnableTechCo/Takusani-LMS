import { formatDay } from "@/lib/dates";

/**
 * Programme reports (C-13; FR-708; R-20): the catalogue's shape, the scope a report runs over, and the words for
 * refusals and export states. The database runs every report and decides who may see what.
 */

export interface ReportColumn {
  key: string;
  label: string;
  numeric: boolean;
}

export interface ReportType {
  report_type: string;
  title: string;
  description: string;
  date_basis: string;
  columns: ReportColumn[];
}

/** The catalogue row's columns arrive as [key, label, numeric] triples. */
export function reportColumns(raw: unknown): ReportColumn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is [string, string, boolean] => Array.isArray(entry) && entry.length === 3)
    .map(([key, label, numeric]) => ({ key, label, numeric: Boolean(numeric) }));
}

export interface ReportScope {
  programmeId: string | null;
  cohortId: string | null;
  from: string | null;
  to: string | null;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The scope from the page's query string; anything malformed is dropped rather than sent. */
export function parseScope(params: Record<string, string | string[] | undefined>): ReportScope {
  const one = (name: string) => {
    const value = params[name];
    return typeof value === "string" ? value.trim() : "";
  };
  const programme = one("programme");
  const cohort = one("cohort");
  const from = one("from");
  const to = one("to");
  return {
    programmeId: UUID.test(programme) ? programme : null,
    cohortId: UUID.test(cohort) ? cohort : null,
    from: DATE.test(from) ? from : null,
    to: DATE.test(to) ? to : null,
  };
}

/** The same scope as a query string, for links between the report pages. */
export function scopeQuery(scope: ReportScope): string {
  const params = new URLSearchParams();
  if (scope.programmeId) params.set("programme", scope.programmeId);
  if (scope.cohortId) params.set("cohort", scope.cohortId);
  if (scope.from) params.set("from", scope.from);
  if (scope.to) params.set("to", scope.to);
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** "2026 Intake B, 01 Sept 2026 to 30 Sept 2026" / "All your cohorts, all dates". */
export function scopeText({
  cohortName,
  from,
  to,
}: {
  cohortName: string | null;
  from: string | null;
  to: string | null;
}): string {
  const who = cohortName ?? "All your cohorts";
  if (from && to) return `${who}, ${formatDay(from)} to ${formatDay(to)}`;
  if (from) return `${who}, from ${formatDay(from)}`;
  if (to) return `${who}, up to ${formatDay(to)}`;
  return `${who}, all dates`;
}

/** A report cell as text: numbers with a thin grouping, nothing as an en dash. */
export function cellText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "number") return new Intl.NumberFormat("en-ZA").format(value);
  return String(value);
}

export const REPORT_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again.",
  invalid_type: "That report does not exist.",
  not_found: "Choose a programme, and a cohort of it, that you coordinate.",
  invalid_range: "The range ends before it starts. Choose the dates again.",
  range_too_long: "Choose a range of three years or less.",
  too_many_exports: "You already have three exports waiting. Wait for one to finish before asking for another.",
  rate_limited: "You have asked for 20 exports in the last hour. Try again later.",
  error: "The report could not be run. Try again.",
};

export const EXPORT_STATE_LABELS: Record<
  string,
  { label: string; tone: "info" | "positive" | "critical" | "neutral" }
> = {
  queued: { label: "Waiting", tone: "info" },
  running: { label: "Being built", tone: "info" },
  ready: { label: "Ready", tone: "positive" },
  failed: { label: "Failed", tone: "critical" },
  expired: { label: "Expired", tone: "neutral" },
};

/** "12 rows, 1.4 KB". */
export function exportSize(rows: number | null, bytes: number | null): string {
  if (rows === null) return "";
  const size =
    bytes === null ? "" : bytes < 1024 ? `, ${bytes} B` : `, ${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;
  return `${rows} ${rows === 1 ? "row" : "rows"}${size}`;
}
