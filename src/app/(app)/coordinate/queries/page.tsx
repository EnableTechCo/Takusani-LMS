import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDay } from "@/lib/dates";
import { listCohorts, listProgrammes } from "@/modules/programmes/queries";
import { LogQueryForm } from "@/modules/programmes/query-forms";
import { listStakeholderQueries } from "@/modules/programmes/query-queries";
import {
  dueText,
  parseQueryShow,
  QUERY_SHOW,
  QUERY_SHOW_LABELS,
  QUERY_SOURCE_LABELS,
  QUERY_STATE_LABELS,
} from "@/modules/programmes/query-rules";

export const metadata = { title: "Queries · Coordinating" };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());

// C-10 (FR-704): queries from outside the teaching team, logged, routed and tracked to closure. The list is the
// coordinator's own scope; overdue ones say so.
export default async function CoordinateQueriesPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const show = parseQueryShow((await searchParams).show);
  const [queries, programmes, cohorts] = await Promise.all([
    listStakeholderQueries(show),
    listProgrammes(),
    listCohorts(),
  ]);
  const now = today();

  return (
    <div className="page">
      <PageHeader
        lead="Queries from employers, funders, learners and the Department, routed to a coordinator and tracked to closure."
        title="Queries"
        workspace="Coordinating"
      />
      <div className="page-layout">
        <div className="page-layout__main stack">
          <form
            action="/coordinate/queries"
            aria-label="Which queries"
            className="table-toolbar"
            method="get"
            role="group"
          >
            {QUERY_SHOW.map((option) => (
              <button
                aria-pressed={option === show}
                className="filter-chip"
                key={option}
                name={option === "open" ? undefined : "show"}
                type="submit"
                value={option === "open" ? undefined : option}
              >
                {QUERY_SHOW_LABELS[option]}
              </button>
            ))}
          </form>
          {queries.length === 0 ? (
            <div className="card">
              <EmptyState icon="inbox" title={show === "closed" ? "No closed queries" : "No queries here"}>
                <p>Log a query when someone outside the teaching team asks the programme something.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption={`${QUERY_SHOW_LABELS[show]} queries: open ones first, soonest due first.`}
              columns={[
                {
                  key: "query",
                  header: "Query",
                  primary: true,
                  cell: (query) => (
                    <>
                      <TextLink href={`/coordinate/queries/${query.id}`}>{query.subject}</TextLink>
                      <span className="table__secondary mono">{query.reference}</span>
                    </>
                  ),
                },
                {
                  key: "from",
                  header: "From",
                  cell: (query) => (
                    <>
                      {query.source_name}
                      <span className="table__secondary">{QUERY_SOURCE_LABELS[query.source_type]}</span>
                    </>
                  ),
                },
                {
                  key: "about",
                  header: "About",
                  cell: (query) => (
                    <>
                      {query.programme_title}
                      {query.cohort_name ? <span className="table__secondary">{query.cohort_name}</span> : null}
                    </>
                  ),
                },
                { key: "owner", header: "With", cell: (query) => query.owner_name ?? "Not routed yet" },
                {
                  key: "due",
                  header: "Due",
                  cell: (query) => {
                    if (!query.due_on) return "No date";
                    const due = dueText(query.due_on, query.state, now);
                    return due?.late ? (
                      <Tag tone="caution">Overdue: {formatDay(query.due_on)}</Tag>
                    ) : (
                      formatDay(query.due_on)
                    );
                  },
                },
                {
                  key: "state",
                  header: "State",
                  cell: (query) => (
                    <Tag
                      shape={query.state === "in_progress" ? "half" : undefined}
                      tone={query.state === "closed" ? "neutral" : "info"}
                    >
                      {QUERY_STATE_LABELS[query.state]}
                    </Tag>
                  ),
                },
              ]}
              rowKey={(query) => query.id}
              rows={queries}
            />
          )}
        </div>
        <aside aria-labelledby="log-query-h" className="page-layout__aside">
          <div className="card">
            <div className="card__body stack">
              <h2 className="text-heading" id="log-query-h">
                Log a query
              </h2>
              <LogQueryForm
                cohorts={cohorts.map((cohort) => ({
                  id: cohort.id,
                  label: `${cohort.name}, ${cohort.programme_title}`,
                }))}
                programmes={programmes.map((programme) => ({ id: programme.id, title: programme.title }))}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
