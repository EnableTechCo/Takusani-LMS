import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { DateTime } from "@/components/ui/records";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { listMyReviews } from "@/modules/appeals/queries";
import { CATEGORY_STAFF_LABELS, type OutcomeCategory } from "@/modules/appeals/rules";

export const metadata = { title: "Appeal reviews" };

const STATE_LABELS: Record<string, string> = {
  allocated: "To review",
  under_review: "Under review",
  concluded: "Decided",
};

// R-01 (FR-609): re-marks allocated to this person, open ones first.
export default async function ReviewAppealsPage() {
  const reviews = await listMyReviews();
  const open = reviews.filter((review) => review.state !== "concluded").length;
  return (
    <div className="page">
      <PageHeader
        lead={
          open === 0
            ? "Appeals you have been allocated to review."
            : `${open === 1 ? "1 appeal is" : `${open} appeals are`} waiting for your decision.`
        }
        title="Appeal reviews"
        workspace="Appeal reviews"
      />
      {reviews.length === 0 ? (
        <div className="card">
          <EmptyState icon="scales" title="No appeals to review">
            <p>When a coordinator allocates you a re-mark, you are told and it appears here.</p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Appeals allocated to you, open ones first. Times in SAST."
          columns={[
            {
              key: "reference",
              header: "Appeal",
              primary: true,
              cell: (review) => (
                <>
                  <span className="u-nowrap">
                    <TextLink href={`/review/appeals/${review.id}`}>{review.reference}</TextLink>
                  </span>
                  <span className="table__secondary">{review.learner_name}</span>
                </>
              ),
            },
            {
              key: "item",
              header: "Work",
              cell: (review) => (
                <>
                  {review.item_title}
                  <span className="table__secondary">{review.cohort_name}</span>
                </>
              ),
            },
            {
              key: "state",
              header: "State",
              cell: (review) =>
                review.state === "concluded" && review.outcome_category ? (
                  <Tag tone="neutral">{CATEGORY_STAFF_LABELS[review.outcome_category as OutcomeCategory]}</Tag>
                ) : (
                  <Tag shape="half" tone={review.state === "allocated" ? "caution" : "info"}>
                    {STATE_LABELS[review.state] ?? review.state}
                  </Tag>
                ),
            },
            {
              key: "allocated",
              header: "Allocated",
              cell: (review) => (review.allocated_at ? <DateTime iso={review.allocated_at} /> : null),
            },
          ]}
          rowKey={(review) => review.id}
          rows={reviews}
        />
      )}
    </div>
  );
}
