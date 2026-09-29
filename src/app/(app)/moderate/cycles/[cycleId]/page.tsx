import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { Log } from "@/components/ui/records";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { ObservationForm } from "@/modules/moderation/review-forms";
import {
  listModerationObservations,
  listMyModerationCycles,
  listMySampleItems,
} from "@/modules/moderation/review-queries";
import { INCLUSION_LABELS, ITEM_STATE_LABELS, itemStateTone, progressText } from "@/modules/moderation/review-rules";

export const metadata = { title: "Cycle · Moderating" };

// M-02 (FR-508, FR-510): one cycle for its moderator: progress, the items they hold, and cohort-level observations.
export default async function ModerateCyclePage({ params }: { params: Promise<{ cycleId: string }> }) {
  const { cycleId } = await params;
  const [cycles, items, observations] = await Promise.all([
    listMyModerationCycles(),
    listMySampleItems(cycleId),
    listModerationObservations(cycleId),
  ]);
  const cycle = cycles.find((row) => row.cycle_id === cycleId);
  if (!cycle) notFound();
  const next = items.find((item) => item.state === "allocated") ?? items.find((item) => item.state === "disagreed");
  const signedOff = cycle.state === "signed_off";

  return (
    <div className="page">
      <PageHeader
        actions={
          next ? (
            <ButtonLink href={`/moderate/cycles/${cycleId}/items/${next.item_id}`} variant="primary">
              Open the next item
            </ButtonLink>
          ) : undefined
        }
        lead={`${cycle.cohort_name}. ${progressText(cycle.my_concluded, cycle.my_items)}${cycle.frozen_at ? ` Frozen ${formatDateTime(cycle.frozen_at)} (SAST); ${cycle.total_items} items in all.` : ""}`}
        meta={
          signedOff ? (
            <Tag tone="positive">Signed off</Tag>
          ) : cycle.my_concluded === cycle.my_items ? (
            <Tag tone="positive">Your items are concluded</Tag>
          ) : (
            <Tag shape="half" tone="info">
              In review
            </Tag>
          )
        }
        title={cycle.name}
        workspace="Moderating"
      />
      <div className="stack stack--lg">
        <section aria-labelledby="items-h" className="stack">
          <h2 className="text-heading" id="items-h">
            Your items
          </h2>
          {items.length === 0 ? (
            <div className="card">
              <EmptyState icon="scales" title="No items in this cycle">
                <p>Items reallocated away from you no longer appear here.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Your sampled items in this cycle, in review order."
              columns={[
                {
                  key: "item",
                  header: "Item",
                  primary: true,
                  cell: (item) => (
                    <>
                      <TextLink href={`/moderate/cycles/${cycleId}/items/${item.item_id}`}>
                        {item.seq}. {item.learner_name}, {item.item_title}
                      </TextLink>
                      {item.learner_number ? (
                        <span className="table__secondary mono">{item.learner_number}</span>
                      ) : null}
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
                    <Tag tone={itemStateTone(item.state)}>{ITEM_STATE_LABELS[item.state] ?? item.state}</Tag>
                  ),
                },
              ]}
              rowKey={(item) => item.item_id}
              rows={items}
            />
          )}
        </section>

        <section aria-labelledby="observations-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="observations-h">
              Observations about the cohort
            </h2>
          </div>
          <div className="card__body stack stack--lg">
            {observations.length === 0 ? (
              <p className="text-small text-muted">
                No observations yet. Moderators of this cycle can add them; the coordinator reads them.
              </p>
            ) : (
              <Log
                entries={observations.map((row) => ({
                  id: row.id,
                  at: row.created_at,
                  actor: row.mine ? "You" : row.moderator_name,
                  event: row.body,
                }))}
                label="Observations, oldest first. Times in SAST."
              />
            )}
            {!signedOff ? <ObservationForm cycleId={cycleId} /> : null}
          </div>
        </section>

        <p>
          <TextLink href="/moderate">All cycles</TextLink>
        </p>
      </div>
    </div>
  );
}
