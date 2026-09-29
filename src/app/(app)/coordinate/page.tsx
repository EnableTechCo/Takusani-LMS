import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatDay } from "@/lib/dates";
import { listAppealsToCoordinate } from "@/modules/appeals/queries";
import { coordinatorStateLabel } from "@/modules/appeals/rules";
import { listSessionLogistics } from "@/modules/learning/logistics-queries";
import { varianceText } from "@/modules/learning/logistics-rules";
import {
  appealsWaiting,
  coordinateLead,
  openReadiness,
  queriesNeedingAttention,
  variancesToReconcile,
  type ReadinessRow,
} from "@/modules/programmes/coordinate-overview-rules";
import { listCohorts } from "@/modules/programmes/queries";
import { listStakeholderQueries } from "@/modules/programmes/query-queries";
import { QUERY_SOURCE_LABELS } from "@/modules/programmes/query-rules";
import { getCohortReadiness } from "@/modules/programmes/setup-queries";

export const metadata = { title: "Overview · Coordinating" };

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(new Date());

// C-01 (FR-604, FR-702, FR-707): what needs attention across the coordinator's cohorts: appeals to act on, open
// setup items, attendance differences to reconcile, and queries to route or chase. The landing page for a coordinator.
export default async function CoordinateOverviewPage() {
  const [appeals, cohorts, logistics, queries] = await Promise.all([
    listAppealsToCoordinate(),
    listCohorts(),
    listSessionLogistics(),
    listStakeholderQueries("open"),
  ]);
  const setup = cohorts.filter((cohort) => cohort.status === "setup");
  const readinessRows = await Promise.all(setup.map((cohort) => getCohortReadiness(cohort.id)));
  const itemsByCohort: Record<string, ReadinessRow[]> = Object.fromEntries(
    setup.map((cohort, index) => [cohort.id, readinessRows[index]]),
  );
  const date = today();
  const waiting = appealsWaiting(appeals);
  const readiness = openReadiness(cohorts, itemsByCohort, date);
  const variances = variancesToReconcile(logistics);
  const attention = queriesNeedingAttention(queries, date);
  const counts = {
    appeals: waiting.length,
    readiness: readiness.length,
    variances: variances.length,
    queries: attention.length,
  };

  return (
    <div className="page">
      <PageHeader lead={coordinateLead(counts)} title="Overview" workspace="Coordinating" />
      <div className="stack stack--lg">
        <div className="grid grid--4" role="list">
          <div className="stat" role="listitem">
            <span className="stat__label">Appeals needing you</span>
            <span className="stat__value">{counts.appeals}</span>
            <span className="stat__meta">To check, or to allocate a reviewer</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Open setup items</span>
            <span className="stat__value">{counts.readiness}</span>
            <span className="stat__meta">
              {setup.length === 1 ? "In 1 cohort being set up" : `In ${setup.length} cohorts being set up`}
            </span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Attendance differences</span>
            <span className="stat__value">{counts.variances}</span>
            <span className="stat__meta">To reconcile with catering</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Queries needing attention</span>
            <span className="stat__value">{counts.queries}</span>
            <span className="stat__meta">Not routed yet, or past their date</span>
          </div>
        </div>

        <section aria-labelledby="appeals-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="appeals-h">
              Appeals
            </h2>
            <TextLink href="/coordinate/appeals">All appeals</TextLink>
          </div>
          {waiting.length === 0 ? (
            <div className="card">
              <EmptyState icon="scales" title="No appeals waiting for you">
                <p>A new appeal appears here until it is checked and, for a re-mark, given a reviewer.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Appeals waiting for the coordinator, longest waiting first. Times in SAST."
              columns={[
                {
                  key: "appeal",
                  header: "Appeal",
                  primary: true,
                  cell: (appeal) => (
                    <>
                      <TextLink href={`/coordinate/appeals/${appeal.id}`}>
                        {appeal.learner_name}, {appeal.item_title}
                      </TextLink>
                      <span className="table__secondary mono">{appeal.reference}</span>
                    </>
                  ),
                },
                { key: "cohort", header: "Cohort", cell: (appeal) => appeal.cohort_name },
                { key: "lodged", header: "Lodged (SAST)", cell: (appeal) => formatDateTime(appeal.lodged_at) },
                {
                  key: "state",
                  header: "Needs",
                  cell: (appeal) => <Tag tone="caution">{coordinatorStateLabel(appeal.type, appeal.state)}</Tag>,
                },
              ]}
              rowKey={(appeal) => appeal.id}
              rows={waiting}
            />
          )}
        </section>

        <section aria-labelledby="readiness-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="readiness-h">
              Cohort setup
            </h2>
            <TextLink href="/coordinate/cohorts">All cohorts</TextLink>
          </div>
          {readiness.length === 0 ? (
            <div className="card">
              <EmptyState icon="check-circle" title="No open setup items">
                <p>Checklist items still open in a cohort being set up appear here, with who has them and by when.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Open checklist items in cohorts being set up: overdue first, then the soonest due."
              columns={[
                {
                  key: "item",
                  header: "Item",
                  primary: true,
                  cell: (item) => (
                    <>
                      <TextLink href={`/coordinate/cohorts/${item.cohortId}/readiness`}>{item.label}</TextLink>
                      <span className="table__secondary">{item.cohortName}</span>
                    </>
                  ),
                },
                { key: "who", header: "With", cell: (item) => item.assigneeName ?? "Not assigned" },
                {
                  key: "due",
                  header: "Due",
                  cell: (item) =>
                    item.dueOn === null ? (
                      "No date"
                    ) : item.overdue ? (
                      <Tag tone="caution">Overdue: {formatDay(item.dueOn)}</Tag>
                    ) : (
                      formatDay(item.dueOn)
                    ),
                },
                {
                  key: "gate",
                  header: "Activation",
                  cell: (item) => (item.gate ? <Tag shape="half">Needed to activate</Tag> : "Not required"),
                },
              ]}
              rowKey={(item) => `${item.cohortId}:${item.itemKey}`}
              rows={readiness}
            />
          )}
        </section>

        <section aria-labelledby="variances-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="variances-h">
              Attendance and catering
            </h2>
            <TextLink href="/coordinate/logistics">Logistics</TextLink>
          </div>
          {variances.length === 0 ? (
            <div className="card">
              <EmptyState icon="calendar" title="No differences to reconcile">
                <p>When a register shows attendance well off the catering headcount, the session appears here.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Sessions whose attendance differed from the confirmed headcount, latest first. Times in SAST."
              columns={[
                {
                  key: "session",
                  header: "Session",
                  primary: true,
                  cell: (session) => (
                    <>
                      <TextLink href={`/coordinate/sessions/${session.session_id}/logistics`}>{session.title}</TextLink>
                      <span className="table__secondary">{session.cohort_name}</span>
                    </>
                  ),
                },
                { key: "when", header: "Held (SAST)", cell: (session) => formatDateTime(session.starts_at) },
                {
                  key: "difference",
                  header: "Difference",
                  cell: (session) => (
                    <Tag tone="caution">{varianceText(session.present ?? 0, session.headcount ?? 0)}</Tag>
                  ),
                },
              ]}
              rowKey={(session) => session.session_id}
              rows={variances}
            />
          )}
        </section>

        <section aria-labelledby="queries-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="queries-h">
              Queries
            </h2>
            <TextLink href="/coordinate/queries">All queries</TextLink>
          </div>
          {attention.length === 0 ? (
            <div className="card">
              <EmptyState icon="inbox" title="No queries need routing or chasing">
                <p>A query nobody owns yet, or one past its date, appears here.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Queries not routed yet, then queries past their date; the longest logged first."
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
                { key: "logged", header: "Logged (SAST)", cell: (query) => formatDateTime(query.logged_at) },
                {
                  key: "needs",
                  header: "Needs",
                  cell: (query) =>
                    query.attention === "not_routed" ? (
                      <Tag tone="info">Routing</Tag>
                    ) : (
                      <Tag tone="caution">Overdue: {formatDay(query.due_on!)}</Tag>
                    ),
                },
              ]}
              rowKey={(query) => query.id}
              rows={attention}
            />
          )}
        </section>
      </div>
    </div>
  );
}
