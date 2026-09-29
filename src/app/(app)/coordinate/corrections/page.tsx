import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { formatDayOf } from "@/lib/dates";
import { ProposeCorrectionForm, type CorrectableOption } from "@/modules/assessment/correction-forms";
import { listCorrectableResults, listCorrections } from "@/modules/assessment/correction-queries";
import { BLOCKER_TEXT } from "@/modules/assessment/correction-rules";
import { CorrectionsTable, type CorrectionListRow } from "@/modules/assessment/correction-views";
import { OUTCOME_LABELS } from "@/modules/assessment/rules";
import { listCohorts } from "@/modules/programmes/queries";

export const metadata = { title: "Result corrections · Coordinating" };

// C-14 (P-12; BR-03): correct a wrongly released outcome under dual control. The corrections in the coordinator's
// cohorts, and proposing one for a released result of a chosen cohort.
export default async function CoordinateCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ cohort?: string }>;
}) {
  const params = await searchParams;
  const [corrections, cohorts] = await Promise.all([listCorrections(), listCohorts()]);
  const active = cohorts.filter((cohort) => cohort.status !== "archived");
  const cohort = active.find((row) => row.id === params.cohort) ?? active[0];
  const results = cohort ? await listCorrectableResults(cohort.id) : [];
  const waiting = corrections.filter((row) => row.state === "proposed");
  const options: CorrectableOption[] = results.map((row) => ({
    result_id: row.result_id,
    label: `${row.learner_name}, ${row.item_title}: ${OUTCOME_LABELS[row.outcome as "competent" | "not_yet_competent"] ?? row.outcome}, released ${formatDayOf(row.released_at)}`,
    outcome: row.outcome,
    disabled: row.open_correction_id
      ? "a correction is waiting"
      : row.blocker
        ? (BLOCKER_TEXT[row.blocker] ?? row.blocker).split(":")[0].toLowerCase()
        : null,
  }));

  return (
    <div className="page">
      <PageHeader
        lead={
          waiting.length === 0
            ? "Correct a released outcome that was wrong, without waiting for an appeal. A second person approves every correction; the original decision stays on record."
            : `${waiting.length} ${waiting.length === 1 ? "correction is" : "corrections are"} waiting for a second person. A correction changes nothing for the learner until it is approved.`
        }
        title="Result corrections"
        workspace="Coordinating"
      />
      <div className="stack stack--lg">
        <section aria-labelledby="list-h" className="stack">
          <h2 className="text-heading" id="list-h">
            Corrections
          </h2>
          <CorrectionsTable base="/coordinate/corrections" rows={corrections as CorrectionListRow[]} />
        </section>

        <section aria-labelledby="propose-h" className="card">
          <div className="card__header">
            <h2 className="card__title" id="propose-h">
              Propose a correction
            </h2>
          </div>
          <div className="card__body stack">
            {active.length > 1 ? (
              <form action="/coordinate/corrections" className="cluster" method="get">
                <label className="field__label" htmlFor="cohort-select">
                  Cohort
                </label>
                <span className="select">
                  <select defaultValue={cohort?.id} id="cohort-select" name="cohort">
                    {active.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </span>
                <Button type="submit" variant="secondary">
                  Show
                </Button>
              </form>
            ) : null}
            {!cohort ? (
              <p className="text-muted">You coordinate no active cohort.</p>
            ) : options.length === 0 ? (
              <p className="text-muted">{cohort.name} has no released results yet.</p>
            ) : (
              <ProposeCorrectionForm key={cohort.id} options={options} />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
