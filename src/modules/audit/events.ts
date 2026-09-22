import { z } from "zod";

/** Plain-language names for audit actions. Unknown actions show their code, so nothing is ever hidden. */
export const ACTION_LABELS: Record<string, string> = {
  "identity.account_created": "Account created",
  "identity.role_assigned": "Role assigned",
};

export function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "Name",
  learner_number: "Learner number",
  status: "Status",
  role: "Role",
  scope_type: "Scope",
};

type Values = Record<string, unknown> | null;

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "none";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * The change an entry records, one line per field: "Role: assessor" when something was set, "Status: active to
 * deactivated" when it changed. Fields that did not change are left out.
 */
export function describeChange(before: Values, after: Values): string[] {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])];
  return keys.flatMap((key) => {
    const was = before?.[key];
    const now = after?.[key];
    if (before && after && show(was) === show(now)) return [];
    const label = FIELD_LABELS[key] ?? key;
    if (!before) return [`${label}: ${show(now)}`];
    if (!after) return [`${label}: ${show(was)} removed`];
    return [`${label}: ${show(was)} to ${show(now)}`];
  });
}

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional()
  .catch(undefined);

const filtersSchema = z.object({
  action: z.string().trim().max(100).optional().catch(undefined),
  actor: z.string().trim().max(320).optional().catch(undefined),
  from: date,
  to: date,
  before: z.coerce.number().int().positive().optional().catch(undefined),
});

export interface AuditFilters {
  action?: string;
  actorEmail?: string;
  /** Inclusive, the start of the day in South African time. */
  from?: string;
  /** Exclusive, the start of the day after, in South African time. */
  to?: string;
  beforeId?: number;
}

/** Filters from the query string. Anything malformed is ignored rather than failing the page. */
export function parseAuditFilters(params: Record<string, string | string[] | undefined>): AuditFilters {
  const single = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) || undefined;
  const parsed = filtersSchema.parse({
    action: single(params.action),
    actor: single(params.actor),
    from: single(params.from),
    to: single(params.to),
    before: single(params.before),
  });
  const nextDay = (day: string) => {
    const d = new Date(`${day}T00:00:00+02:00`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString();
  };
  return {
    action: parsed.action || undefined,
    actorEmail: parsed.actor || undefined,
    from: parsed.from ? new Date(`${parsed.from}T00:00:00+02:00`).toISOString() : undefined,
    to: parsed.to ? nextDay(parsed.to) : undefined,
    beforeId: parsed.before,
  };
}
