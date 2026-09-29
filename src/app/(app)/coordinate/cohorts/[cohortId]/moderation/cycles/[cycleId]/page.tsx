import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Log } from "@/components/ui/records";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatDateTimeSeconds } from "@/lib/dates";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { getModerationSample, listModerationCycles } from "@/modules/moderation/cycle-queries";
import {
  allocationsText,
  cycleStateText,
  mandatoryText,
  periodText,
  sampleShareText,
  scopeText,
} from "@/modules/moderation/cycle-rules";
import { ReallocateForm } from "@/modules/moderation/review-forms";
import {
  listCycleSampleItems,
  listModerationObservations,
  listSampleModeratorCandidates,
} from "@/modules/moderation/review-queries";
import { dueText, INCLUSION_LABELS, ITEM_STATE_LABELS, itemStateTone } from "@/modules/moderation/review-rules";
import { getCohort } from "@/modules/programmes/queries";

export const metadata = { title: "Cycle and sample record · Coordinating" };

// C-07 (FR-502 to FR-505, FR-504): the audit view of one cycle: its sample record, every sampled item with who
// holds it and where it stands, reallocation with the separation-of-duties refusal, and the moderators'
// observations.
export default async function CycleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ cohortId: string; cycleId: string }>;
  searchParams: Promise<{ reallocated?: string }>;
}) {
  const [{ cohortId, cycleId }, notice] = await Promise.all([params, searchParams]);
  const [cohort, cycles, sample, items, observations] = await Promise.all([
    getCohort(cohortId),
    listModerationCycles(cohortId),
    getModerationSample(cycleId),
    listCycleSampleItems(cycleId),
    listModerationObservations(cycleId),
  ]);
  const cycle = cycles.find((row) => row.id === cycleId);
  if (!cohort || !cycle) notFound();
  const candidates = await Promise.all(
    items.map((item) =>
      item.state === "agreed" || cycle.state !== "frozen" ? [] : listSampleModeratorCandidates(item.item_id),
    ),
  );
  const concluded = items.filter((item) => item.state === "agreed").length;
  const unallocated = items.filter((item) => !item.moderator_id).length;

  return (
    <div className="page">
      <PageHeader
        lead={`${cohort.name}. ${scopeText(cycle, [])}${periodText(cycle.period_from, cycle.period_to) ? `. ${periodText(cycle.period_from, cycle.period_to)}` : ""}. Planned by ${cycle.planned_by_name}, ${formatDateTime(cycle.planned_at)} (SAST).`}
        meta={
          <>
            <Tag tone={cycle.state === "signed_off" ? "positive" : cycle.state === "frozen" ? "info" : undefined}>
              {cycleStateText(cycle)}
            </Tag>
            {sample ? (
              <span>
                {concluded} of {items.length} items concluded
              </span>
            ) : null}
            {unallocated > 0 ? <Tag tone="caution">{unallocated} waiting for a moderator</Tag> : null}
          </>
        }
        title={cycle.name}
        workspace="Coordinating"
      />
      <CohortNav cohortId={cohortId} current="Moderation" />
      <div className="stack stack--lg">
        {notice.reallocated ? (
          <Banner compact role="status" title="The item is reallocated" tone="positive">
            <p>The new moderator has been told.</p>
          </Banner>
        ) : null}

        {!sample ? (
          <div className="card">
            <EmptyState icon="scales" title="Not frozen yet">
              <p>
                The sample record and the items appear once the cycle is frozen.{" "}
                <TextLink href={`/coordinate/cohorts/${cohortId}/moderation`}>Back to moderation planning</TextLink>
              </p>
            </EmptyState>
          </div>
        ) : (
          <>
            <section aria-labelledby="sample-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="sample-h">
                  Sample record
                </h2>
                <span className="text-small text-muted">
                  Drawn {formatDateTimeSeconds(sample.frozen_at)} (SAST)
                  {sample.frozen_by_name ? ` by ${sample.frozen_by_name}` : " at the scheduled start"}
                </span>
              </div>
              <div className="card__body stack">
                <div className="grid grid--4" role="list">
                  <div className="stat" role="listitem">
                    <span className="stat__label">Population</span>
                    <span className="stat__value">{sample.population}</span>
                    <span className="stat__meta">Fixed. It cannot grow or shrink.</span>
                  </div>
                  <div className="stat" role="listitem">
                    <span className="stat__label">Sample</span>
                    <span className="stat__value">{sample.sample_size}</span>
                    <span className="stat__meta">{sampleShareText(sample.sample_size, sample.population)}</span>
                  </div>
                  <div className="stat" role="listitem">
                    <span className="stat__label">Mandatory inclusions</span>
                    <span className="stat__value">{sample.mandatory_nyc + sample.mandatory_first_time}</span>
                    <span className="stat__meta">
                      {mandatoryText(sample.mandatory_nyc, sample.mandatory_first_time)}
                    </span>
                  </div>
                  <div className="stat" role="listitem">
                    <span className="stat__label">Random draw</span>
                    <span className="stat__value">{sample.random_draw}</span>
                    <span className="stat__meta">{sample.percentage}% of the rest, by assessor, outcome and unit</span>
                  </div>
                </div>
                <DataTable
                  caption="Sample by stratum: population, sampled and the reason."
                  columns={[
                    { key: "stratum", header: "Stratum", primary: true, cell: (row) => row.stratum },
                    { key: "population", header: "In population", numeric: true, cell: (row) => row.population },
                    { key: "sampled", header: "In sample", numeric: true, cell: (row) => row.sampled },
                    { key: "why", header: "Why", cell: (row) => row.why },
                  ]}
                  rowKey={(row) => row.stratum}
                  rows={sample.strata}
                />
                <dl className="dl">
                  <div className="dl__row">
                    <dt>Sampling rule and seed</dt>
                    <dd className="mono">
                      rule v{sample.rule_version} · {sample.percentage}% · seed {sample.seed} · sampler{" "}
                      {sample.algorithm_version}
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Population digest</dt>
                    <dd className="mono">sha256:{sample.digest}</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Allocation</dt>
                    <dd>{allocationsText(sample)}.</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section aria-labelledby="items-h" className="stack">
              <h2 className="text-heading" id="items-h">
                Sampled items
              </h2>
              <DataTable
                caption="Every sampled item, in review order, with the moderator who holds it and where it stands."
                columns={[
                  {
                    key: "item",
                    header: "Item",
                    primary: true,
                    cell: (item) => (
                      <>
                        <span className="table__primary">
                          {item.seq}. {item.learner_name}, {item.item_title}
                        </span>
                        <span className="table__secondary">
                          {item.learner_number ? `${item.learner_number} · ` : ""}
                          {INCLUSION_LABELS[item.inclusion_reason] ?? item.inclusion_reason}
                        </span>
                      </>
                    ),
                  },
                  {
                    key: "decision",
                    header: "Assessor decided",
                    cell: (item) => (
                      <>
                        {OUTCOME_LABELS[item.outcome as "competent" | "not_yet_competent"] ?? item.outcome}
                        <span className="table__secondary">{item.assessor_name}</span>
                      </>
                    ),
                  },
                  {
                    key: "moderator",
                    header: "Moderator",
                    cell: (item) =>
                      item.moderator_name ? (
                        <>
                          {item.moderator_name}
                          {item.allocated_at ? (
                            <span className="table__secondary">since {formatDateTime(item.allocated_at)}</span>
                          ) : null}
                        </>
                      ) : (
                        <Tag tone="caution">Nobody eligible</Tag>
                      ),
                  },
                  {
                    key: "state",
                    header: "State",
                    cell: (item) => (
                      <>
                        <Tag tone={itemStateTone(item.state)}>{ITEM_STATE_LABELS[item.state] ?? item.state}</Tag>
                        {item.state === "returned" && item.due_on ? (
                          <span className="table__secondary">{dueText(item.due_on, new Date())}</span>
                        ) : item.last_finding_at ? (
                          <span className="table__secondary">{formatDateTime(item.last_finding_at)}</span>
                        ) : null}
                      </>
                    ),
                  },
                ]}
                rowKey={(item) => item.item_id}
                rows={items}
              />
              {cycle.state === "frozen"
                ? items.map((item, index) =>
                    item.state === "agreed" ? null : (
                      <details className="disclosure" key={item.item_id}>
                        <summary>
                          Reallocate item {item.seq}: {item.learner_name}, {item.item_title}
                        </summary>
                        <div className="card">
                          <div className="card__body">
                            <ReallocateForm
                              candidates={candidates[index]}
                              cohortId={cohortId}
                              cycleId={cycleId}
                              itemId={item.item_id}
                            />
                          </div>
                        </div>
                      </details>
                    ),
                  )
                : null}
            </section>

            <section aria-labelledby="observations-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="observations-h">
                  Moderators&apos; observations about the cohort
                </h2>
              </div>
              <div className="card__body">
                {observations.length === 0 ? (
                  <p className="text-small text-muted">None yet.</p>
                ) : (
                  <Log
                    entries={observations.map((row) => ({
                      id: row.id,
                      at: row.created_at,
                      actor: row.moderator_name,
                      event: row.body,
                    }))}
                    label="Observations, oldest first. Times in SAST."
                  />
                )}
              </div>
            </section>
          </>
        )}
        <p>
          <TextLink href={`/coordinate/cohorts/${cohortId}/moderation`}>Back to moderation planning</TextLink>
        </p>
      </div>
    </div>
  );
}
