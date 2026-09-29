import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { listMySampleItems } from "@/modules/moderation/review-queries";
import { INCLUSION_LABELS, ITEM_STATE_LABELS, itemStateTone } from "@/modules/moderation/review-rules";

export const metadata = { title: "My sample items · Moderating" };

// The moderator's items across every cycle, those still to review first.
export default async function ModerateItemsPage() {
  const items = await listMySampleItems();
  const rows = [...items].sort((a, b) => Number(a.state === "agreed") - Number(b.state === "agreed"));

  return (
    <div className="page">
      <PageHeader
        lead="Every sampled item given to you, across cycles. Items still to review come first."
        title="My sample items"
        workspace="Moderating"
      />
      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="scales" title="No items yet">
            <p>Items appear here when a cycle you moderate is frozen and sampled.</p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Your sample items: to review first, then concluded."
          columns={[
            {
              key: "item",
              header: "Item",
              primary: true,
              cell: (item) => (
                <>
                  <TextLink href={`/moderate/cycles/${item.cycle_id}/items/${item.item_id}`}>
                    {item.learner_name}, {item.item_title}
                  </TextLink>
                  <span className="table__secondary">
                    {item.cycle_name} · {item.cohort_name} · item {item.seq} of {item.total}
                  </span>
                </>
              ),
            },
            {
              key: "decision",
              header: "Assessor decided",
              cell: (item) => OUTCOME_LABELS[item.outcome as "competent" | "not_yet_competent"] ?? item.outcome,
            },
            {
              key: "why",
              header: "In the sample because",
              cell: (item) => INCLUSION_LABELS[item.inclusion_reason] ?? item.inclusion_reason,
            },
            {
              key: "state",
              header: "State",
              cell: (item) => (
                <>
                  <Tag tone={itemStateTone(item.state)}>{ITEM_STATE_LABELS[item.state] ?? item.state}</Tag>
                  {item.last_finding_at ? (
                    <span className="table__secondary">{formatDateTime(item.last_finding_at)}</span>
                  ) : null}
                </>
              ),
            },
            {
              key: "open",
              header: "Actions",
              actions: true,
              cell: (item) => (
                <ButtonLink href={`/moderate/cycles/${item.cycle_id}/items/${item.item_id}`} size="sm">
                  {item.state === "agreed" ? "View" : "Review"}
                  <span className="u-visually-hidden"> {item.learner_name}</span>
                </ButtonLink>
              ),
            },
          ]}
          rowKey={(item) => item.item_id}
          rows={rows}
        />
      )}
    </div>
  );
}
