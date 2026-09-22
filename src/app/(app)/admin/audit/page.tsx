import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { ACTION_LABELS, actionLabel, describeChange, parseAuditFilters } from "@/modules/audit/events";
import { AUDIT_PAGE_SIZE, listAuditEvents } from "@/modules/audit/queries";
import { roleLabels } from "@/modules/identity/access";

export const metadata = { title: "Audit log · Administration" };

const WHEN = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Africa/Johannesburg",
});

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
              <button className="btn btn--primary" type="submit">
                Show entries
              </button>
              <Link className="link" href="/admin/audit">
                Clear filters
              </Link>
            </div>
          </div>
        </form>

        {events.length === 0 ? (
          <div className="card">
            <div className="empty">
              <p className="empty__title">No audit entries</p>
              <p className="empty__body">Nothing matches these filters.</p>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table table--cards">
              <caption className="u-visually-hidden">Audit entries, newest first. Times in SAST.</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Done by</th>
                  <th scope="col">Action</th>
                  <th scope="col">On</th>
                  <th scope="col">Change</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td data-label="When">
                      <time dateTime={event.occurred_at}>{WHEN.format(new Date(event.occurred_at))}</time>
                    </td>
                    <td data-label="Done by">
                      <span className="table__primary">{event.actor_name ?? "System provisioning"}</span>
                      <span className="table__secondary">
                        {[
                          event.actor_email,
                          event.acting_role ? `as ${roleLabels([event.acting_role])[0] ?? event.acting_role}` : null,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </td>
                    <td data-label="Action">{actionLabel(event.action)}</td>
                    <td data-label="On">
                      <span className="table__primary">{event.object_label ?? event.object_id}</span>
                      <span className="table__secondary">{event.object_type}</span>
                    </td>
                    <td data-label="Change">
                      <ul className="stack stack--sm">
                        {describeChange(
                          event.before as Record<string, unknown> | null,
                          event.after as Record<string, unknown> | null,
                        ).map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav aria-label="Audit log pages" className="cluster">
          {filters.beforeId ? (
            <Link className="btn btn--secondary" href={withCursor(params)}>
              Newest entries
            </Link>
          ) : null}
          {events.length === AUDIT_PAGE_SIZE && oldest ? (
            <Link className="btn btn--secondary" href={withCursor(params, oldest)}>
              Older entries
            </Link>
          ) : null}
        </nav>
      </div>
    </div>
  );
}
