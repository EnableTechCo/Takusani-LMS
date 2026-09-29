import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { DateTime } from "@/components/ui/records";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { listMyAppeals } from "@/modules/appeals/queries";
import { getPublicSettings } from "@/modules/audit/settings";
import {
  APPEAL_TYPE_LABELS,
  CATEGORY_LEARNER_LABELS,
  isOpen,
  LEARNER_STATE_LABELS,
  type AppealState,
  type AppealType,
  type OutcomeCategory,
} from "@/modules/appeals/rules";

export const metadata = { title: "Appeals" };

// L-17 (FR-612): the learner's appeals, newest first.
export default async function LearnAppealsPage() {
  const [appeals, settings] = await Promise.all([listMyAppeals(), getPublicSettings()]);
  return (
    <div className="page">
      <PageHeader lead="Every appeal you have sent, and where it stands." title="Your appeals" workspace="Learning" />
      {appeals.length === 0 ? (
        <div className="card">
          <EmptyState
            actions={
              <ButtonLink href="/learn/results" variant="secondary">
                Your results
              </ButtonLink>
            }
            icon="scales"
            title="You have not sent an appeal"
          >
            <p>
              You can appeal a result from its page, within {settings.appealWindowDays} days of the day it was ready.
            </p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Your appeals, newest first. Times in SAST."
          columns={[
            {
              key: "reference",
              header: "Appeal",
              primary: true,
              cell: (appeal) => (
                <>
                  <span className="u-nowrap">
                    <TextLink href={`/learn/appeals/${appeal.id}`}>{appeal.reference}</TextLink>
                  </span>
                  <span className="table__secondary">{appeal.item_title}</span>
                </>
              ),
            },
            { key: "type", header: "You asked for", cell: (appeal) => APPEAL_TYPE_LABELS[appeal.type as AppealType] },
            {
              key: "state",
              header: "Where it stands",
              cell: (appeal) =>
                appeal.outcome_category ? (
                  <Tag tone="neutral">{CATEGORY_LEARNER_LABELS[appeal.outcome_category as OutcomeCategory]}</Tag>
                ) : (
                  <Tag
                    shape={isOpen(appeal.state) ? "half" : undefined}
                    tone={isOpen(appeal.state) ? "info" : "neutral"}
                  >
                    {LEARNER_STATE_LABELS[appeal.state as AppealState]}
                  </Tag>
                ),
            },
            { key: "lodged", header: "Sent", cell: (appeal) => <DateTime iso={appeal.lodged_at} /> },
          ]}
          rowKey={(appeal) => appeal.id}
          rows={appeals}
        />
      )}
    </div>
  );
}
