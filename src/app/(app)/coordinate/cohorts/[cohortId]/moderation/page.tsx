import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, EmptyState, Meter, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime, formatDateTimeSeconds, formatDayOf } from "@/lib/dates";
import { CancelCycleForm, FreezeCycleForm, PlanCycleForm, type UnitOption } from "@/modules/moderation/cycle-forms";
import {
  getModerationPool,
  getModerationSample,
  getModerationSummary,
  listModerationCycles,
} from "@/modules/moderation/cycle-queries";
import {
  allocationsText,
  assessorsText,
  cycleStateText,
  holdCaution,
  holdDays,
  holdText,
  itemFateText,
  mandatoryText,
  periodText,
  poolLead,
  sampleShareText,
  samplingRuleText,
  scopeText,
  startText,
  type CycleRow,
} from "@/modules/moderation/cycle-rules";
import { getCohort } from "@/modules/programmes/queries";
import { MODERATION_POLICY_LABELS } from "@/modules/programmes/rules";

export const metadata = { title: "Moderation planning · Coordinating" };

function cycleTone(state: string): "info" | "positive" | "neutral" | undefined {
  if (state === "planned") return undefined;
  if (state === "frozen") return "info";
  if (state === "signed_off") return "positive";
  return "neutral";
}

// C-06 (P0-15; FR-501, FR-506; ADR-019; P-02): the pending pool by assignment with its age against the maximum
// hold, the cohort's cycles, and planning or cancelling one. Freeze and sampling arrive with S4-06.
export default async function ModerationPlanningPage({
  params,
  searchParams,
}: {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ planned?: string; cancelled?: string; frozen?: string }>;
}) {
  const [{ cohortId }, notice] = await Promise.all([params, searchParams]);
  const [cohort, summary, pool, cycles] = await Promise.all([
    getCohort(cohortId),
    getModerationSummary(cohortId),
    getModerationPool(cohortId),
    listModerationCycles(cohortId),
  ]);
  if (!cohort || !summary) notFound();
  const frozenCycles = cycles.filter((cycle) => cycle.state === "frozen" || cycle.state === "signed_off");
  const samples = await Promise.all(frozenCycles.map((cycle) => getModerationSample(cycle.id)));

  const now = new Date();
  const moderated = summary.moderation_policy === "moderated";
  const maxDays = summary.max_hold_days;
  const waitingDays = holdDays(summary.oldest_waiting_at, now);
  const heldDays = holdDays(summary.oldest_held_at, now);
  const planned = cycles.filter((cycle) => cycle.state === "planned");
  const units: UnitOption[] = [];
  for (const row of pool) {
    if (!row.unit_id) continue;
    const unit = units.find((entry) => entry.id === row.unit_id);
    if (unit) {
      unit.items += 1;
      unit.waiting += row.waiting;
      unit.openCycleName ??= row.open_cycle_name;
    } else {
      units.push({
        id: row.unit_id,
        code: row.unit_code,
        title: row.unit_title,
        items: 1,
        waiting: row.waiting,
        openCycleName: row.open_cycle_name,
      });
    }
  }
  const unitNames = units.map((unit) => ({ id: unit.id, code: unit.code, title: unit.title }));
  const justPlanned = notice.planned ? cycles.find((cycle) => cycle.id === notice.planned) : undefined;
  const justCancelled = notice.cancelled ? cycles.find((cycle) => cycle.id === notice.cancelled) : undefined;
  const justFrozen = notice.frozen ? frozenCycles.find((cycle) => cycle.id === notice.frozen) : undefined;
  const justFrozenSample = justFrozen ? samples[frozenCycles.indexOf(justFrozen)] : null;
  const assessorSummary = (() => {
    const totals = new Map<string, number>();
    for (const row of pool) for (const a of row.assessors) totals.set(a.name, (totals.get(a.name) ?? 0) + a.count);
    return assessorsText([...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));
  })();

  return (
    <div className="page">
      <PageHeader
        lead={poolLead(summary, now)}
        meta={
          <>
            <span>
              {cohort.name}{" "}
              <Tag plain>
                {summary.moderation_policy ? MODERATION_POLICY_LABELS[summary.moderation_policy] : "No policy yet"}
              </Tag>
            </span>
            {moderated && summary.waiting > 0 && planned.length === 0 ? (
              <Tag tone="caution">Results waiting, no cycle planned</Tag>
            ) : null}
            {planned.length > 0 ? (
              <Tag>{planned.length === 1 ? "1 cycle planned" : `${planned.length} cycles planned`}</Tag>
            ) : null}
            {summary.frozen_cycles > 0 ? (
              <Tag tone="info">
                {summary.frozen_cycles === 1 ? "1 cycle frozen" : `${summary.frozen_cycles} cycles frozen`}
              </Tag>
            ) : null}
          </>
        }
        title="Moderation planning"
        workspace="Coordinating"
      />
      <CohortNav cohortId={cohortId} current="Moderation" />

      <div className="stack stack--lg">
        {justPlanned ? (
          <Banner compact role="status" title={`"${justPlanned.name}" is planned`} tone="positive">
            <p>
              {justPlanned.scheduled_start_at
                ? `It freezes by itself on ${formatDateTime(justPlanned.scheduled_start_at)} (SAST) and locks every waiting result in its scope at that moment.`
                : "It freezes when you choose Freeze and sample, and locks every waiting result in its scope at that moment."}
            </p>
          </Banner>
        ) : null}
        {justFrozen ? (
          <Banner compact role="status" title={`"${justFrozen.name}" is frozen and sampled`} tone="positive">
            <p>
              {justFrozenSample
                ? `${justFrozenSample.population} results are locked as the population; ${justFrozenSample.sample_size} were sampled. ${allocationsText(justFrozenSample)}.`
                : "The population is locked and the sample drawn."}
            </p>
          </Banner>
        ) : null}
        {justCancelled ? (
          <Banner compact role="status" title={`"${justCancelled.name}" is cancelled`} tone="positive">
            <p>Its results stay waiting for another cycle.</p>
          </Banner>
        ) : null}

        {!moderated ? (
          <Banner role="note" title="This cohort is not moderated" tone="readonly">
            <p>
              Results are released as soon as the assessor decides, so there is nothing to plan here. To moderate this
              cohort, change its policy on the{" "}
              <TextLink href={`/coordinate/cohorts/${cohortId}/setup`}>setup page</TextLink>.
            </p>
          </Banner>
        ) : (
          <>
            <section aria-labelledby="pool-h" className="stack">
              <div className="section__header">
                <h2 className="text-heading" id="pool-h">
                  Decided and waiting for a cycle
                </h2>
                <span className="text-small text-muted">Held results that no cycle has locked yet</span>
              </div>
              <div className="grid grid--3" role="list">
                <div className="stat" role="listitem">
                  <span className="stat__label">Waiting for a cycle</span>
                  <span className="stat__value">
                    {summary.waiting} <span className="stat__unit">results</span>
                  </span>
                  <span className="stat__meta">
                    {summary.waiting === 0
                      ? "Nothing is waiting."
                      : `${assessorSummary}. ${planned.length === 0 ? "No cycle will claim them." : "A planned cycle claims those in its scope."}`}
                  </span>
                </div>
                <div className="stat" role="listitem">
                  <span className="stat__label">Oldest waiting result</span>
                  <span className="stat__value">
                    {waitingDays}{" "}
                    <span className="stat__unit">{maxDays ? `days of the ${maxDays}-day maximum hold` : "days"}</span>
                  </span>
                  <span className="stat__meta">
                    {summary.oldest_waiting_at
                      ? `Decided ${formatDayOf(summary.oldest_waiting_at)}`
                      : "Nothing is waiting."}
                  </span>
                  {summary.oldest_waiting_at && maxDays ? (
                    <Meter
                      caution={holdCaution(waitingDays, maxDays)}
                      label="Age of the oldest waiting result"
                      max={maxDays}
                      value={waitingDays}
                      valueText={holdText(waitingDays, maxDays)}
                    />
                  ) : null}
                </div>
                <div className="stat" role="listitem">
                  <span className="stat__label">Held in a frozen cycle</span>
                  <span className="stat__value">
                    {summary.held} <span className="stat__unit">results</span>
                  </span>
                  <span className="stat__meta">
                    {summary.held === 0
                      ? "Nothing is frozen yet."
                      : `Oldest decided ${heldDays === 0 ? "today" : `${heldDays} days ago`}${maxDays ? `, of the ${maxDays}-day maximum hold` : ""}.`}
                  </span>
                  {summary.oldest_held_at && maxDays ? (
                    <Meter
                      caution={holdCaution(heldDays, maxDays)}
                      label="Age of the oldest held result"
                      max={maxDays}
                      value={heldDays}
                      valueText={holdText(heldDays, maxDays)}
                    />
                  ) : null}
                </div>
              </div>
              {pool.length === 0 ? (
                <div className="card">
                  <EmptyState icon="clipboard" title="Nothing has been handed in yet">
                    <p>An assignment appears here once a learner hands in and an assessor decides.</p>
                  </EmptyState>
                </div>
              ) : (
                <DataTable
                  caption="Waiting results by assignment, with the assessor split and the age of the oldest."
                  columns={[
                    {
                      key: "item",
                      header: "Assignment",
                      primary: true,
                      cell: (row) => (
                        <>
                          <span className="table__primary">{row.title}</span>
                          <span className="table__secondary">
                            {row.unit_code ? `Unit ${row.unit_code}` : "No unit"}
                          </span>
                        </>
                      ),
                    },
                    {
                      key: "assessors",
                      header: "By assessor",
                      cell: (row) => assessorsText(row.assessors) || "Nobody yet",
                    },
                    { key: "waiting", header: "Waiting", numeric: true, cell: (row) => row.waiting },
                    {
                      key: "oldest",
                      header: "Oldest decided",
                      cell: (row) => (row.oldest_decided_at ? formatDayOf(row.oldest_decided_at) : "Nothing waiting"),
                    },
                    {
                      key: "age",
                      header: maxDays ? `Age against the ${maxDays}-day maximum hold` : "Age",
                      cell: (row) => {
                        if (!row.oldest_decided_at) return "";
                        const days = holdDays(row.oldest_decided_at, now);
                        return holdCaution(days, maxDays) ? (
                          <Tag tone="caution">{holdText(days, maxDays)}</Tag>
                        ) : (
                          <span className="mono">{holdText(days, maxDays)}</span>
                        );
                      },
                    },
                    {
                      key: "fate",
                      header: "What happens to them",
                      cell: (row) => {
                        const fate = itemFateText(row);
                        return fate.tone === "neutral" ? (
                          <span className="text-muted">{fate.text}</span>
                        ) : (
                          <Tag tone={fate.tone}>{fate.text}</Tag>
                        );
                      },
                    },
                  ]}
                  rowKey={(row) => row.item_id}
                  rows={pool}
                />
              )}
            </section>

            <section aria-labelledby="cycles-h" className="stack">
              <div className="section__header">
                <h2 className="text-heading" id="cycles-h">
                  Cycles
                </h2>
                <TextLink href="#plan-h">Plan a cycle</TextLink>
              </div>
              {cycles.length === 0 ? (
                <div className="card">
                  <EmptyState icon="scales" title="No cycles yet">
                    <p>
                      Plan one below. It locks the waiting results in its scope when it freezes, draws the sample, and
                      releases them when it is signed off.
                    </p>
                  </EmptyState>
                </div>
              ) : (
                <DataTable
                  caption={`Moderation cycles for ${cohort.name}, newest first.`}
                  columns={[
                    {
                      key: "cycle",
                      header: "Cycle",
                      primary: true,
                      cell: (cycle: CycleRow) => (
                        <>
                          <span className="table__primary">{cycle.name}</span>
                          <span className="table__secondary">
                            Planned by {cycle.planned_by_name}, {formatDayOf(cycle.planned_at)}
                          </span>
                        </>
                      ),
                    },
                    {
                      key: "scope",
                      header: "Scope",
                      cell: (cycle) => (
                        <>
                          {scopeText(cycle, unitNames)}
                          {periodText(cycle.period_from, cycle.period_to) ? (
                            <span className="table__secondary">{periodText(cycle.period_from, cycle.period_to)}</span>
                          ) : null}
                        </>
                      ),
                    },
                    { key: "start", header: "Start (SAST)", cell: (cycle) => startText(cycle.scheduled_start_at) },
                    {
                      key: "state",
                      header: "State",
                      cell: (cycle) => (
                        <Tag shape={cycle.state === "cancelled" ? "square" : undefined} tone={cycleTone(cycle.state)}>
                          {cycleStateText(cycle)}
                        </Tag>
                      ),
                    },
                    {
                      key: "results",
                      header: "Results",
                      cell: (cycle) =>
                        cycle.state === "planned"
                          ? `${cycle.waiting} waiting now`
                          : cycle.state === "cancelled"
                            ? `Cancelled by ${cycle.cancelled_by_name}, ${formatDayOf(cycle.cancelled_at!)}: ${cycle.cancel_reason}`
                            : `${cycle.held} held · ${cycle.sampled} sampled`,
                    },
                  ]}
                  rowKey={(cycle) => cycle.id}
                  rows={cycles}
                />
              )}
              {planned.map((cycle) => (
                <div className="card" key={cycle.id}>
                  <div className="card__header">
                    <h3 className="card__title">{cycle.name}</h3>
                    <Tag>{cycleStateText(cycle)}</Tag>
                  </div>
                  <div className="card__body stack">
                    <dl className="dl">
                      <div className="dl__row">
                        <dt>Scope</dt>
                        <dd>
                          {scopeText(cycle, unitNames)}
                          {periodText(cycle.period_from, cycle.period_to)
                            ? `. ${periodText(cycle.period_from, cycle.period_to)}`
                            : ". No period limit"}
                        </dd>
                      </div>
                      <div className="dl__row">
                        <dt>Start</dt>
                        <dd>
                          {cycle.scheduled_start_at
                            ? `Automatically on ${formatDateTime(cycle.scheduled_start_at)} (SAST)`
                            : "When you choose Freeze and sample"}
                        </dd>
                      </div>
                      <div className="dl__row">
                        <dt>Population if frozen now</dt>
                        <dd>
                          {cycle.waiting} {cycle.waiting === 1 ? "result" : "results"}. It can still grow until the
                          freeze.
                        </dd>
                      </div>
                      <div className="dl__row">
                        <dt>Sampling rule in force</dt>
                        <dd>{samplingRuleText(summary)}</dd>
                      </div>
                    </dl>
                    <FreezeCycleForm
                      cohortId={cohortId}
                      cycleId={cycle.id}
                      name={cycle.name}
                      version={cycle.version}
                      waiting={cycle.waiting}
                    />
                    <CancelCycleForm cohortId={cohortId} cycleId={cycle.id} name={cycle.name} version={cycle.version} />
                  </div>
                </div>
              ))}
            </section>

            {frozenCycles.map((cycle, index) => {
              const sample = samples[index];
              if (!sample) return null;
              return (
                <section aria-labelledby={`sample-${cycle.id}`} className="card" key={cycle.id}>
                  <div className="card__header">
                    <h3 className="card__title" id={`sample-${cycle.id}`}>
                      {cycle.name}: sample record
                    </h3>
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
                        <span className="stat__meta">
                          {sample.percentage}% of the other{" "}
                          {sample.population - sample.mandatory_nyc - sample.mandatory_first_time}, by assessor, outcome
                          and unit
                        </span>
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
                    <p className="text-small text-muted">
                      The same population, rule version and seed always give the same {sample.sample_size} items. The
                      sample cannot be redrawn, and the cycle can no longer be cancelled: its results are released by
                      sign-off.
                    </p>
                  </div>
                </section>
              );
            })}

            <section aria-labelledby="plan-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="plan-h">
                  Plan a cycle
                </h2>
              </div>
              <div className="card__body">
                <PlanCycleForm
                  cohortId={cohortId}
                  items={pool}
                  samplingRule={samplingRuleText(summary)}
                  units={units}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
