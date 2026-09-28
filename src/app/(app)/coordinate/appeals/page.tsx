import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { DateTime } from "@/components/ui/records";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { listAppealsToCoordinate } from "@/modules/appeals/queries";
import {
  APPEAL_TYPE_STAFF_LABELS,
  coordinatorStateLabel,
  isOpen,
  needsCoordinator,
  type AppealType,
} from "@/modules/appeals/rules";

export const metadata = { title: "Appeals · Coordinating" };

// C-12 (FR-604): appeals in the cohorts this coordinator runs, open ones first and oldest first.
export default async function CoordinateAppealsPage() {
  const appeals = await listAppealsToCoordinate();
  const waiting = appeals.filter((appeal) => needsCoordinator(appeal.type, appeal.state)).length;
  return (
    <div className="page">
      <PageHeader
        lead={
          waiting === 0
            ? "Appeals lodged by learners in the cohorts you coordinate."
            : `${waiting === 1 ? "1 appeal needs" : `${waiting} appeals need`} your action: a check, or a reviewer. Oldest first.`
        }
        title="Appeals"
        workspace="Coordinating"
      />
      {appeals.length === 0 ? (
        <div className="card">
          <EmptyState icon="scales" title="No appeals">
            <p>When a learner lodges an appeal in one of your cohorts, you are told and it appears here.</p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Appeals, open ones first and oldest first. Times in SAST."
          columns={[
            {
              key: "reference",
              header: "Appeal",
              primary: true,
              cell: (appeal) => (
                <>
                  <span className="u-nowrap">
                    <TextLink href={`/coordinate/appeals/${appeal.id}`}>{appeal.reference}</TextLink>
                  </span>
                  <span className="table__secondary">
                    {appeal.learner_name}
                    {appeal.learner_number ? ` · ${appeal.learner_number}` : ""}
                  </span>
                </>
              ),
            },
            {
              key: "item",
              header: "Result",
              cell: (appeal) => (
                <>
                  {appeal.item_title}
                  <span className="table__secondary">{appeal.cohort_name}</span>
                </>
              ),
            },
            {
              key: "type",
              header: "Asked for",
              cell: (appeal) => APPEAL_TYPE_STAFF_LABELS[appeal.type as AppealType],
            },
            {
              key: "state",
              header: "State",
              cell: (appeal) => (
                <Tag
                  shape={isOpen(appeal.state) ? "half" : undefined}
                  tone={
                    needsCoordinator(appeal.type, appeal.state) ? "caution" : isOpen(appeal.state) ? "info" : "neutral"
                  }
                >
                  {coordinatorStateLabel(appeal.type, appeal.state)}
                </Tag>
              ),
            },
            {
              key: "reviewer",
              header: "Reviewer",
              cell: (appeal) => (appeal.type === "remark" ? (appeal.reviewer_name ?? "None yet") : "Not needed"),
            },
            { key: "lodged", header: "Lodged", cell: (appeal) => <DateTime iso={appeal.lodged_at} /> },
          ]}
          rowKey={(appeal) => appeal.id}
          rows={appeals}
        />
      )}
    </div>
  );
}
