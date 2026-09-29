import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { QueryActionsForm, RouteQueryForm } from "@/modules/programmes/query-forms";
import { getStakeholderQuery } from "@/modules/programmes/query-queries";
import {
  dueText,
  eventText,
  QUERY_SOURCE_LABELS,
  QUERY_STATE_LABELS,
  type QueryEvent,
} from "@/modules/programmes/query-rules";

export const metadata = { title: "Query · Coordinating" };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());

// C-10 (FR-704): one query. What was asked and by whom, who has it, the steps to work it, and its history.
export default async function CoordinateQueryPage({
  params,
  searchParams,
}: {
  params: Promise<{ queryId: string }>;
  searchParams: Promise<{ logged?: string }>;
}) {
  const [{ queryId }, flash] = await Promise.all([params, searchParams]);
  const query = await getStakeholderQuery(queryId);
  if (!query) notFound();
  const events = (query.events ?? []) as unknown as QueryEvent[];
  const owners = (query.owners ?? []) as unknown as { profile_id: string; full_name: string }[];
  const due = dueText(query.due_on, query.state, today());
  const closed = query.state === "closed";

  return (
    <div className="page">
      <PageHeader
        lead={`${query.source_name} (${QUERY_SOURCE_LABELS[query.source_type]?.toLowerCase()}) about ${query.programme_title}${
          query.cohort_name ? `, ${query.cohort_name}` : ""
        }.`}
        meta={
          <>
            <Tag shape={query.state === "in_progress" ? "half" : undefined} tone={closed ? "neutral" : "info"}>
              {QUERY_STATE_LABELS[query.state]}
            </Tag>
            <span className="mono">{query.reference}</span>
            {due ? due.late ? <Tag tone="caution">{due.text}</Tag> : <span>{due.text}</span> : null}
            <span>{query.owner_name ? `With ${query.owner_name}` : "Not routed yet"}</span>
          </>
        }
        title={query.subject}
        workspace="Coordinating"
      />
      <div className="page-layout">
        <div className="page-layout__main stack stack--lg">
          {flash.logged ? (
            <Banner
              compact
              role="status"
              title={`Logged as ${query.reference}. Route it to whoever will answer.`}
              tone="positive"
            />
          ) : null}

          <section aria-labelledby="asked-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="asked-h">
                What they asked
              </h2>
            </div>
            <div className="card__body stack">
              <p className="whitespace-pre-line">{query.details}</p>
              <dl className="dl">
                <div className="dl__row">
                  <dt>From</dt>
                  <dd>
                    {query.source_name}, {QUERY_SOURCE_LABELS[query.source_type]?.toLowerCase()}
                  </dd>
                </div>
                {query.contact ? (
                  <div className="dl__row">
                    <dt>How to reply</dt>
                    <dd>{query.contact}</dd>
                  </div>
                ) : null}
                <div className="dl__row">
                  <dt>Logged</dt>
                  <dd>
                    {formatDateTime(query.logged_at)} (SAST) by {query.logged_by_name}
                  </dd>
                </div>
              </dl>
            </div>
          </section>

          {closed ? (
            <section aria-labelledby="resolution-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="resolution-h">
                  How it was resolved
                </h2>
              </div>
              <div className="card__body stack">
                <p className="whitespace-pre-line">{query.resolution}</p>
                <p className="text-small text-muted">
                  Closed {query.closed_at ? formatDateTime(query.closed_at) : ""} (SAST) by {query.closed_by_name}.
                </p>
              </div>
            </section>
          ) : (
            <section aria-labelledby="route-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="route-h">
                  {query.owner_name ? `With ${query.owner_name}` : "Route it"}
                </h2>
              </div>
              <div className="card__body">
                <RouteQueryForm ownerId={query.owner_id} owners={owners} queryId={query.id} />
              </div>
            </section>
          )}

          <section aria-labelledby="work-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="work-h">
                {closed ? "Reopen it" : "Work on it"}
              </h2>
            </div>
            <div className="card__body">
              <QueryActionsForm queryId={query.id} state={query.state} steps={events.length} />
            </div>
          </section>
          <p>
            <TextLink href="/coordinate/queries">All queries</TextLink>
          </p>
        </div>

        <aside aria-labelledby="history-h" className="page-layout__aside">
          <div className="card">
            <div className="card__body stack">
              <h2 className="text-heading" id="history-h">
                History
              </h2>
              <ol className="stack" role="list">
                {events.map((event, index) => (
                  <li className="stack stack--sm" key={index}>
                    <span>
                      <strong>{eventText(event)}</strong>
                      <span className="text-small text-muted"> · {formatDateTime(event.at)}</span>
                    </span>
                    {event.note ? <span className="text-small whitespace-pre-line">{event.note}</span> : null}
                  </li>
                ))}
              </ol>
              <p className="text-small text-muted">Times are SAST. The history cannot be changed.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
