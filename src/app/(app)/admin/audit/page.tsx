import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/link";
import { DateTime } from "@/components/ui/records";
import { EmptyState } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { ACTION_LABELS, actionLabel, describeChange, parseAuditFilters } from "@/modules/audit/events";
import { AUDIT_PAGE_SIZE, listAuditEvents } from "@/modules/audit/queries";
import { roleLabels } from "@/modules/identity/access";

export const metadata = { title: "Audit log · Administration" };

type Params = Record<string, string | string[] | undefined>;

/** The current filters as a query string, with the page cursor replaced. */
function withCursor(params: Params, before?: number) {
  const query = new URLSearchParams();
  for (const key of ["action", "actor", "from", "to"]) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }
  if (before) query.set("before", String(before));
  const text = query.toString();
  return text ? `/admin/audit?${text}` : "/admin/audit";
}

// X-09 (FR-107, NFR-02): reconstruct who changed what. Newest first; filters work without JavaScript.
export default async function AuditLogPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters = parseAuditFilters(params);
  const events = await listAuditEvents(filters);
  const oldest = events.at(-1)?.id;
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : "");

  return (
    <div className="page">
      <PageHeader workspace="Administration" title="Audit log" lead="Who changed what, and when. Times are SAST." />
      <div className="stack stack--lg">
        <form className="card" method="get">
          <div className="card__body stack">
            <div className="grid grid--4">
              <div className="field">
                <label className="field__label" htmlFor="audit-action">
                  Action
                </label>
                <span className="select">
                  <select defaultValue={value("action")} id="audit-action" name="action">
                    <option value="">All actions</option>
                    {Object.entries(ACTION_LABELS).map(([code, label]) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </span>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="audit-actor">
                  Done by (email)
                </label>
                <input className="input" defaultValue={value("actor")} id="audit-actor" name="actor" type="email" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="audit-from">
                  From
                </label>
                <input className="input" defaultValue={value("from")} id="audit-from" name="from" type="date" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="audit-to">
                  To
                </label>
                <input className="input" defaultValue={value("to")} id="audit-to" name="to" type="date" />
              </div>
            </div>
            <div className="cluster">
              <Button type="submit" variant="primary">
                Show entries
              </Button>
              <Link className="link" href="/admin/audit">
                Clear filters
              </Link>
            </div>
          </div>
        </form>

        {events.length === 0 ? (
          <div className="card">
            <EmptyState icon="filter" title="No audit entries">
              <p>Nothing matches these filters.</p>
            </EmptyState>
          </div>
        ) : (
          // The audit log is two-dimensional: it scrolls sideways on phones rather than becoming cards.
          <DataTable
            caption="Audit entries, newest first. Times in SAST."
            cards={false}
            columns={[
              { key: "when", header: "When", cell: (event) => <DateTime iso={event.occurred_at} seconds /> },
              {
                key: "actor",
                header: "Done by",
                cell: (event) => (
                  <>
                    <span className="table__primary">{event.actor_name ?? "System provisioning"}</span>
                    <span className="table__secondary">
                      {[
                        event.actor_email,
                        event.acting_role ? `as ${roleLabels([event.acting_role])[0] ?? event.acting_role}` : null,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </>
                ),
              },
              { key: "action", header: "Action", cell: (event) => actionLabel(event.action) },
              {
                key: "object",
                header: "On",
                cell: (event) => (
                  <>
                    <span className="table__primary">{event.object_label ?? event.object_id}</span>
                    <span className="table__secondary">{event.object_type}</span>
                  </>
                ),
              },
              {
                key: "change",
                header: "Change",
                cell: (event) => (
                  <ul className="stack stack--sm">
                    {describeChange(
                      event.before as Record<string, unknown> | null,
                      event.after as Record<string, unknown> | null,
                    ).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ),
              },
            ]}
            rowKey={(event) => String(event.id)}
            rows={events}
          />
        )}

        <nav aria-label="Audit log pages" className="cluster">
          {filters.beforeId ? <ButtonLink href={withCursor(params)}>Newest entries</ButtonLink> : null}
          {events.length === AUDIT_PAGE_SIZE && oldest ? (
            <ButtonLink href={withCursor(params, oldest)}>Older entries</ButtonLink>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
