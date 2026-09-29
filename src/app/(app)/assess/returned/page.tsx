import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listMyReturnedItems } from "@/modules/assessment/queries";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { dueText } from "@/modules/moderation/review-rules";

export const metadata = { title: "Returned to me · Assessing" };

// A-04 (FR-509, FR-410): the items a moderator returned to this assessor, with what to correct and by when, soonest
// due first. Re-marking happens in the marking workspace, in re-mark mode.
export default async function AssessReturnedPage() {
  const rows = await listMyReturnedItems();
  const now = new Date();
  const overdue = rows.filter((row) => row.overdue).length;

  return (
    <div className="page">
      <PageHeader
        lead={
          rows.length === 0
            ? "When a moderator returns one of your decisions for re-marking, it appears here with the required corrections and the deadline."
            : `${rows.length} ${rows.length === 1 ? "item" : "items"} to re-mark${overdue > 0 ? `, ${overdue} past ${overdue === 1 ? "its" : "their"} deadline` : ""}. A re-mark is a new decision; the original stays on record, and the result stays held. Times are SAST.`
        }
        title="Returned to me"
        workspace="Assessing"
      />
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="check-circle" title="Nothing returned to you">
            <p>
              Moderators return an item only when they disagree with a decision. Your held decisions are under Cohort
              release status.
            </p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Items returned to you for re-marking, soonest deadline first. Times in SAST."
          columns={[
            {
              key: "learner",
              header: "Learner",
              primary: true,
              cell: (row) => (
                <>
                  <span className="table__primary">{row.learner_name}</span>
                  {row.learner_number ? <span className="table__secondary mono">{row.learner_number}</span> : null}
                </>
              ),
            },
            {
              key: "item",
              header: "Item",
              cell: (row) => (
                <>
                  {row.item_title}
                  <span className="table__secondary">
                    {row.cohort_name} · {row.cycle_name}
                  </span>
                </>
              ),
            },
            {
              key: "decision",
              header: "Your decision",
              cell: (row) => (
                <>
                  {OUTCOME_LABELS[row.outcome as "competent" | "not_yet_competent"] ?? row.outcome}
                  <span className="table__secondary">Decided {formatDateTime(row.decided_at)}</span>
                </>
              ),
            },
            {
              key: "corrections",
              header: "Required corrections",
              cell: (row) => (
                <>
                  <span className="whitespace-pre-line">{row.corrections}</span>
                  <span className="table__secondary">
                    {row.moderator_name}, {formatDateTime(row.returned_at)}
                  </span>
                </>
              ),
            },
            {
              key: "due",
              header: "Deadline",
              cell: (row) => (
                <>
                  <Tag tone={row.overdue ? "caution" : "info"}>{dueText(row.due_on, now)}</Tag>
                  {row.instance_state === "marking" ? (
                    <span className="table__secondary">Re-mark in progress</span>
                  ) : row.instance_state === "superseded" ? (
                    <span className="table__secondary">A later version arrived: mark it from the queue</span>
                  ) : null}
                </>
              ),
            },
            {
              key: "open",
              header: "Actions",
              actions: true,
              cell: (row) => (
                <ButtonLink
                  href={`/assess/instances/${row.instance_id}`}
                  size="sm"
                  variant={row.instance_state === "superseded" ? "secondary" : "primary"}
                >
                  {row.instance_state === "marking" ? "Continue re-mark" : "Re-mark"}
                  <span className="u-visually-hidden">
                    {" "}
                    {row.learner_name}, {row.item_title}
                  </span>
                </ButtonLink>
              ),
            },
          ]}
          rowKey={(row) => row.return_id}
          rows={rows}
        />
      )}
    </div>
  );
}
