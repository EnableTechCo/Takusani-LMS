import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatDayOf } from "@/lib/dates";
import { listMyReleaseStatus } from "@/modules/assessment/queries";
import { isHeld, stageText, summarise, type ReleaseRow } from "@/modules/assessment/release-status";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";

export const metadata = { title: "Cohort release status · Assessing" };

// How many settled decisions to list; the counts above cover every one.
const RECENT = 50;

function StageTag({ row }: { row: ReleaseRow }) {
  if (row.stage === "released") return <Tag tone="positive">{stageText(row)}</Tag>;
  if (row.stage === "in_moderation")
    return (
      <Tag shape="half" tone="info">
        {stageText(row)}
      </Tag>
    );
  if (row.stage === "waiting_for_cycle") return <Tag tone="info">{stageText(row)}</Tag>;
  if (row.stage === "returned") return <Tag tone="caution">{stageText(row)}</Tag>;
  return <Tag plain>{stageText(row)}</Tag>;
}

function OpenLink({ row }: { row: ReleaseRow }) {
  if (!row.instance_id) return null;
  return (
    <ButtonLink href={`/assess/instances/${row.instance_id}`} size="sm" variant="secondary">
      Open
      <span className="u-visually-hidden">
        {" "}
        {row.learner_name}, {row.item_title}
      </span>
    </ButtonLink>
  );
}

const learnerColumn = {
  key: "learner",
  header: "Learner",
  primary: true,
  cell: (row: ReleaseRow) => (
    <>
      <span className="table__primary">{row.learner_name}</span>
      {row.learner_number ? <span className="table__secondary mono">{row.learner_number}</span> : null}
    </>
  ),
};

const itemColumn = {
  key: "item",
  header: "Item",
  cell: (row: ReleaseRow) => (
    <>
      {row.item_title}
      <span className="table__secondary">{row.cohort_name}</span>
    </>
  ),
};

const outcomeColumn = {
  key: "outcome",
  header: "Your decision",
  cell: (row: ReleaseRow) => OUTCOME_LABELS[row.outcome] ?? row.outcome,
};

// A-03 (FR-409; UX spec 7.3, 7.4): where the assessor's decisions stand. Held ones first, because they are what the
// learner is still waiting for; then each cohort and item; then what was released. Decided and released are always
// two facts with two dates.
export default async function AssessCohortsPage() {
  const rows = await listMyReleaseStatus();
  const held = rows.filter(isHeld);
  const settled = rows.filter((row) => !isHeld(row));
  const cohorts = summarise(rows);
  const waiting = held.filter((row) => row.stage === "waiting_for_cycle").length;
  const inModeration = held.length - waiting;
  const released = rows.filter((row) => row.stage === "released").length;

  return (
    <div className="page">
      <PageHeader
        workspace="Assessing"
        title="Cohort release status"
        lead="Where your decisions stand: held for moderation, with the moderator, or released. Times are SAST."
      />
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="inbox" title="You have not decided anything yet">
            <p>Once you finalise a decision, it appears here with where it stands and when the learner got it.</p>
          </EmptyState>
        </div>
      ) : (
        <div className="stack stack--lg">
          <section aria-labelledby="summary-h">
            <div className="section__header">
              <h2 className="text-heading" id="summary-h">
                Your decisions
              </h2>
              <span className="text-small text-muted">
                {rows.length} {rows.length === 1 ? "decision" : "decisions"} in {cohorts.length}{" "}
                {cohorts.length === 1 ? "cohort" : "cohorts"}
              </span>
            </div>
            <div className="grid grid--3">
              <div className="stat">
                <span className="stat__label">Waiting for a moderation cycle</span>
                <span className="stat__value">{waiting}</span>
                <span className="stat__meta">Decided and held. No cycle has claimed them yet.</span>
              </div>
              <div className="stat">
                <span className="stat__label">In moderation</span>
                <span className="stat__value">{inModeration}</span>
                <span className="stat__meta">Claimed by a cycle. Released when the moderator signs it off.</span>
              </div>
              <div className="stat">
                <span className="stat__label">Released</span>
                <span className="stat__value">{released}</span>
                <span className="stat__meta">The learner has these results.</span>
              </div>
            </div>
          </section>

          <section aria-labelledby="held-h">
            <div className="section__header">
              <h2 className="text-heading" id="held-h">
                Held: not yet released
              </h2>
              <span className="text-small text-muted">The learner sees “Being assessed” until release</span>
            </div>
            {held.length === 0 ? (
              <p className="text-muted">Nothing you decided is held.</p>
            ) : (
              <DataTable
                caption="Your held decisions, newest first. Times in SAST."
                columns={[
                  learnerColumn,
                  itemColumn,
                  outcomeColumn,
                  { key: "decided", header: "Decided", cell: (row) => formatDateTime(row.decided_at) },
                  { key: "stage", header: "Where it stands", cell: (row) => <StageTag row={row} /> },
                  { key: "open", header: "Actions", actions: true, cell: (row) => <OpenLink row={row} /> },
                ]}
                rowKey={(row) => row.decision_id}
                rows={held}
              />
            )}
          </section>

          <section aria-labelledby="cohorts-h" className="stack">
            <h2 className="text-heading" id="cohorts-h">
              By cohort
            </h2>
            {cohorts.map((cohort) => (
              <section aria-labelledby={`cohort-${cohort.cohortId}`} className="card" key={cohort.cohortId}>
                <div className="card__header">
                  <h3 className="card__title" id={`cohort-${cohort.cohortId}`}>
                    {cohort.cohortName}
                  </h3>
                  <Tag plain>{cohort.moderated ? "Moderated" : "Not moderated"}</Tag>
                </div>
                <div className="card__body">
                  <DataTable
                    caption={`${cohort.cohortName}: your decisions per item.`}
                    columns={[
                      { key: "item", header: "Item", primary: true, cell: (item) => item.itemTitle },
                      { key: "decided", header: "Decided", numeric: true, cell: (item) => item.decided },
                      { key: "waiting", header: "Waiting for a cycle", numeric: true, cell: (item) => item.waiting },
                      {
                        key: "moderation",
                        header: "In moderation",
                        numeric: true,
                        cell: (item) => item.inModeration,
                      },
                      { key: "released", header: "Released", numeric: true, cell: (item) => item.released },
                      {
                        key: "last",
                        header: "Last released",
                        cell: (item) => (item.lastReleasedAt ? formatDayOf(item.lastReleasedAt) : "Not yet"),
                      },
                    ]}
                    rowKey={(item) => item.itemId}
                    rows={cohort.items}
                  />
                </div>
              </section>
            ))}
          </section>

          {settled.length > 0 ? (
            <section aria-labelledby="released-h">
              <div className="section__header">
                <h2 className="text-heading" id="released-h">
                  Released and replaced
                </h2>
                <span className="text-small text-muted">
                  {settled.length > RECENT
                    ? `The ${RECENT} most recent of ${settled.length}`
                    : "A replaced decision stays on record"}
                </span>
              </div>
              <DataTable
                caption="Your released and replaced decisions, newest first. Times in SAST."
                columns={[
                  learnerColumn,
                  itemColumn,
                  outcomeColumn,
                  { key: "decided", header: "Decided", cell: (row) => formatDateTime(row.decided_at) },
                  {
                    key: "released",
                    header: "Released",
                    cell: (row) => (row.released_at ? formatDateTime(row.released_at) : "Not released"),
                  },
                  { key: "stage", header: "Where it stands", cell: (row) => <StageTag row={row} /> },
                  { key: "open", header: "Actions", actions: true, cell: (row) => <OpenLink row={row} /> },
                ]}
                rowKey={(row) => row.decision_id}
                rows={settled.slice(0, RECENT)}
              />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
