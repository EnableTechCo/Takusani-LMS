import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { listMyModerationCycles } from "@/modules/moderation/review-queries";
import { progressText } from "@/modules/moderation/review-rules";

export const metadata = { title: "Cycles · Moderating" };

// M-01 (FR-504): the cycles in which this moderator holds sampled items, with their progress. The landing page for
// a moderator.
export default async function ModerateHomePage() {
  const cycles = await listMyModerationCycles();
  const open = cycles.filter((cycle) => cycle.state !== "signed_off");
  const todo = open.reduce((sum, cycle) => sum + cycle.my_items - cycle.my_concluded, 0);

  return (
    <div className="page">
      <PageHeader
        lead={
          cycles.length === 0
            ? "When a moderation cycle is frozen and sampled, the items given to you appear here."
            : todo === 0
              ? "Every item you hold is concluded."
              : `${todo} ${todo === 1 ? "item needs" : "items need"} your finding across ${open.length} ${open.length === 1 ? "cycle" : "cycles"}.`
        }
        title="Cycles"
        workspace="Moderating"
      />
      {cycles.length === 0 ? (
        <div className="card">
          <EmptyState icon="scales" title="No cycles yet">
            <p>
              You are given items when a coordinator freezes a cycle in a cohort you moderate. You are never given work
              you assessed.
            </p>
          </EmptyState>
        </div>
      ) : (
        <DataTable
          caption="Moderation cycles you hold items in: open ones first, most recently frozen first."
          columns={[
            {
              key: "cycle",
              header: "Cycle",
              primary: true,
              cell: (cycle) => (
                <>
                  <span className="table__primary">{cycle.name}</span>
                  <span className="table__secondary">{cycle.cohort_name}</span>
                </>
              ),
            },
            {
              key: "frozen",
              header: "Frozen (SAST)",
              cell: (cycle) => (cycle.frozen_at ? formatDateTime(cycle.frozen_at) : "Not yet"),
            },
            {
              key: "progress",
              header: "Your items",
              cell: (cycle) => progressText(cycle.my_concluded, cycle.my_items),
            },
            {
              key: "state",
              header: "State",
              cell: (cycle) =>
                cycle.state === "signed_off" ? (
                  <Tag tone="positive">
                    Signed off. {cycle.released_count ?? 0} {cycle.released_count === 1 ? "result" : "results"} released
                  </Tag>
                ) : cycle.open_returns > 0 ? (
                  <Tag tone="caution">Waiting for re-marks ({cycle.open_returns} outstanding)</Tag>
                ) : cycle.total_concluded === cycle.total_items ? (
                  <Tag tone="positive">Ready to sign off</Tag>
                ) : cycle.my_concluded === cycle.my_items ? (
                  <Tag tone="positive">Your items are concluded</Tag>
                ) : (
                  <Tag shape="half" tone="info">
                    In review
                  </Tag>
                ),
            },
            {
              key: "open",
              header: "Actions",
              actions: true,
              cell: (cycle) => (
                <span className="cluster">
                  <ButtonLink href={`/moderate/cycles/${cycle.cycle_id}`} size="sm">
                    Open<span className="u-visually-hidden"> {cycle.name}</span>
                  </ButtonLink>
                  {cycle.state === "frozen" && cycle.may_sign ? (
                    <ButtonLink
                      href={`/moderate/cycles/${cycle.cycle_id}/sign-off`}
                      size="sm"
                      variant={cycle.total_concluded === cycle.total_items ? "primary" : "secondary"}
                    >
                      Sign off<span className="u-visually-hidden"> {cycle.name}</span>
                    </ButtonLink>
                  ) : null}
                </span>
              ),
            },
          ]}
          rowKey={(cycle) => cycle.cycle_id}
          rows={cycles}
        />
      )}
    </div>
  );
}
