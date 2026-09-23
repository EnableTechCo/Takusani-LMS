import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { getMyAccess } from "@/modules/identity/session";
import { listMarkingQueue } from "@/modules/assessment/queries";

export const metadata = { title: "Queue · Assessing" };

// A-01 (FR-401): the work waiting to be marked in the cohorts this assessor covers, oldest first.
export default async function AssessQueuePage() {
  const [queue, access] = await Promise.all([listMarkingQueue(), getMyAccess()]);
  const me = access?.profile_id;

  return (
    <div className="page">
      <PageHeader
        workspace="Assessing"
        title="Queue"
        lead="Work waiting to be marked in your cohorts, oldest first. Times are SAST."
      />
      {queue.length === 0 ? (
        <div className="card">
          <EmptyState icon="inbox" title="Nothing to mark right now">
            <p>New submissions from your cohorts appear here as soon as they are handed in.</p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Marking queue, oldest submission first. Times in SAST."
          columns={[
            {
              key: "learner",
              header: "Learner",
              primary: true,
              cell: (item) => (
                <>
                  <span className="table__primary">{item.learner_name}</span>
                  {item.learner_number ? <span className="table__secondary mono">{item.learner_number}</span> : null}
                </>
              ),
            },
            {
              key: "item",
              header: "Item",
              cell: (item) => (
                <>
                  {item.task_title}
                  <span className="table__secondary">{item.cohort_name}</span>
                </>
              ),
            },
            {
              key: "submitted",
              header: "Submitted (SAST)",
              cell: (item) => `${formatDateTime(item.submitted_at)} · version ${item.version_number}`,
            },
            {
              key: "status",
              header: "Status",
              cell: (item) =>
                item.assessor_id === null ? (
                  <Tag tone={item.is_late ? "caution" : "neutral"}>{item.is_late ? "To mark, late" : "To mark"}</Tag>
                ) : item.assessor_id === me ? (
                  <Tag shape="half" tone="info">
                    {item.draft_saved_at ? `Marking, draft saved ${formatDateTime(item.draft_saved_at)}` : "Marking"}
                  </Tag>
                ) : (
                  <Tag plain>Being marked by {item.assessor_name}</Tag>
                ),
            },
            {
              key: "open",
              header: "Actions",
              actions: true,
              cell: (item) => (
                <ButtonLink href={`/assess/instances/${item.instance_id}`} size="sm">
                  {item.assessor_id === me ? "Continue" : "Mark"}
                  <span className="u-visually-hidden">
                    {" "}
                    {item.learner_name}, {item.task_title}
                  </span>
                </ButtonLink>
              ),
            },
          ]}
          rowKey={(item) => item.instance_id}
          rows={queue}
        />
      )}
    </div>
  );
}
