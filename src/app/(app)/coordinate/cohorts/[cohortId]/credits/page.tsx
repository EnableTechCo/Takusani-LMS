import { notFound } from "next/navigation";
import { CohortNav } from "@/components/shell/cohort-nav";
import { PageHeader } from "@/components/shell/page-header";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { DiscardDraftForm, FreezeRequirementsForm, RequirementDraftForm } from "@/modules/credits/requirement-forms";
import { getCohortCreditRequirements } from "@/modules/credits/requirement-queries";
import {
  draftChanges,
  freezeConsequence,
  frozenText,
  requiredTitles,
  requirementText,
  startingPairs,
  type RequirementUnit,
} from "@/modules/credits/requirement-rules";

export async function generateMetadata({ params }: { params: Promise<{ cohortId: string }> }) {
  const data = await getCohortCreditRequirements((await params).cohortId);
  return { title: data ? `${data.cohortName}: credits · Coordinating` : "Not found" };
}

// C-16 (S6-01; FR-801; P-07; ADR-022): which of the cohort's assessments each unit requires before its credits are
// awarded. A draft is edited and frozen; a frozen version never changes, and a later one needs a reason. Awards follow
// from released results; this page shows how many learners hold each unit from this cohort.
export default async function CohortCreditsPage({
  params,
  searchParams,
}: {
  params: Promise<{ cohortId: string }>;
  searchParams: Promise<{ saved?: string; frozen?: string; awarded?: string; discarded?: string }>;
}) {
  const [{ cohortId }, flags] = await Promise.all([params, searchParams]);
  const data = await getCohortCreditRequirements(cohortId);
  if (!data) notFound();
  const { units, items, sets } = data;
  const inForce = sets.find((set) => set.in_force);
  const draft = sets.find((set) => set.frozen_at === null);
  const frozen = sets.filter((set) => set.frozen_at !== null).reverse();
  const archived = data.cohortStatus === "archived";
  const changes = draft ? draftChanges(inForce, draft) : null;
  const draftMissingValue = draft
    ? units.filter((unit) => unit.credits === null && draft.requirements.some((pair) => pair.unit_id === unit.unit_id))
    : [];

  return (
    <div className="page">
      <PageHeader
        lead={
          inForce
            ? `Version ${inForce.version} is in force. A unit's credits are awarded when every assessment it needs is released Competent, and reversed if one later becomes Not yet competent.`
            : "No requirements are frozen yet, so no credits are awarded from this cohort. Choose which assessments each unit needs, then freeze the list."
        }
        title={`${data.cohortName}: credits`}
        workspace="Coordinating"
      />
      <CohortNav cohortId={data.cohortId} current="Credits" />
      <div className="stack stack--lg">
        {flags.frozen ? (
          <Banner role="status" title={frozenText(Number(flags.frozen), Number(flags.awarded ?? 0))} tone="positive" />
        ) : flags.saved ? (
          <Banner role="status" title="Draft saved. Nothing changes for learners until it is frozen." tone="positive" />
        ) : flags.discarded ? (
          <Banner role="status" title="Draft discarded. The version in force is unchanged." tone="positive" />
        ) : null}

        <section aria-labelledby="in-force-h" className="stack">
          <h2 className="text-heading" id="in-force-h">
            {inForce ? `In force: version ${inForce.version}` : "In force"}
          </h2>
          {inForce ? (
            <>
              <p className="text-small text-muted">
                Frozen {formatDateTime(inForce.frozen_at!)} by {inForce.frozen_by_name ?? "a coordinator"}.
                {inForce.reason ? ` Why: ${inForce.reason}` : ""}
              </p>
              <DataTable
                caption="Units of the programme, with the assessments each needs in the version in force."
                columns={[
                  {
                    key: "unit",
                    header: "Unit",
                    primary: true,
                    cell: (unit: RequirementUnit) => (
                      <>
                        <span className="table__primary">
                          {unit.code}: {unit.title}
                        </span>
                        <span className="table__secondary">{unit.qualification_title}</span>
                      </>
                    ),
                  },
                  {
                    key: "needs",
                    header: "Needs",
                    cell: (unit: RequirementUnit) => requirementText(requiredTitles(inForce, unit.unit_id, items)),
                  },
                  {
                    key: "credits",
                    header: "Credits",
                    numeric: true,
                    cell: (unit: RequirementUnit) => (unit.credits === null ? "Not set" : unit.credits),
                  },
                  {
                    key: "awarded",
                    header: "Learners awarded",
                    numeric: true,
                    cell: (unit: RequirementUnit) => unit.awarded_learners,
                  },
                ]}
                rowKey={(unit) => unit.unit_id}
                rows={units}
              />
            </>
          ) : (
            <div className="card">
              <EmptyState icon="chart" title="Nothing frozen yet">
                <p>
                  Until a version is frozen, released results earn no credits. Results already released count once it
                  is.
                </p>
              </EmptyState>
            </div>
          )}
        </section>

        {archived ? null : (
          <section aria-labelledby="draft-h" className="card" id="draft">
            <div className="card__header">
              <h2 className="card__title" id="draft-h">
                {draft
                  ? `Draft: version ${draft.version}`
                  : inForce
                    ? "Change the requirements"
                    : "Set the requirements"}
              </h2>
              {draft ? <Tag tone="caution">Not frozen</Tag> : null}
            </div>
            <div className="card__body stack">
              {units.length === 0 ? (
                <p>This cohort&apos;s programme has no units yet.</p>
              ) : items.length === 0 ? (
                <p>
                  This cohort has no published assignments yet. Each one can count towards a unit once it is published.
                </p>
              ) : (
                <RequirementDraftForm
                  chosen={startingPairs(sets, items)}
                  cohortId={data.cohortId}
                  items={items}
                  units={units}
                />
              )}
              {draft ? (
                <div className="stack">
                  <h3 className="text-subheading">Freeze the draft</h3>
                  <p className="text-small">
                    {inForce && changes
                      ? `Against version ${inForce.version}: ${changes.added} ${changes.added === 1 ? "requirement" : "requirements"} added, ${changes.removed} removed.`
                      : `${draft.requirements.length} ${draft.requirements.length === 1 ? "requirement" : "requirements"}.`}{" "}
                    Saved {formatDateTime(draft.updated_at)}. Save the form above first if you changed it.
                  </p>
                  {draftMissingValue.length > 0 ? (
                    <Banner
                      title={`${draftMissingValue.map((unit) => unit.code).join(", ")} ${draftMissingValue.length === 1 ? "has" : "have"} no credit value in force, so the draft cannot be frozen. An administrator sets it under Configuration.`}
                      tone="caution"
                    />
                  ) : null}
                  <FreezeRequirementsForm
                    changing={inForce !== undefined}
                    cohortId={data.cohortId}
                    consequence={freezeConsequence(draft.version, inForce !== undefined)}
                    requirementSetId={draft.requirement_set_id}
                    version={draft.version}
                  />
                  <DiscardDraftForm cohortId={data.cohortId} />
                </div>
              ) : null}
            </div>
          </section>
        )}

        {frozen.length > 0 ? (
          <section aria-labelledby="history-h" className="stack">
            <h2 className="text-heading" id="history-h">
              Versions
            </h2>
            <DataTable
              caption="Frozen versions, newest first. Times in SAST."
              columns={[
                {
                  key: "version",
                  header: "Version",
                  primary: true,
                  cell: (set) => (
                    <>
                      <span className="table__primary">Version {set.version}</span>
                      {set.in_force ? (
                        <span className="table__secondary">
                          <Tag shape="check" tone="positive">
                            In force
                          </Tag>
                        </span>
                      ) : null}
                    </>
                  ),
                },
                {
                  key: "frozen",
                  header: "Frozen",
                  cell: (set) => `${formatDateTime(set.frozen_at!)} by ${set.frozen_by_name ?? "a coordinator"}`,
                },
                { key: "reason", header: "Why", cell: (set) => set.reason ?? "The first version" },
                { key: "awards", header: "Awards made under it", numeric: true, cell: (set) => set.awards },
              ]}
              rowKey={(set) => set.requirement_set_id}
              rows={frozen}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
