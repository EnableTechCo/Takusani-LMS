import { PageHeader } from "@/components/shell/page-header";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { ConcludeCorrectionForm, WithdrawCorrectionForm } from "./correction-forms";
import { CANNOT_CONCLUDE_TEXT, CORRECTION_STATE_LABELS, approveConsequence, correctionTone } from "./correction-rules";
import { OUTCOME_LABELS } from "./rules";

/**
 * C-14 (P-12; BR-03): the corrections list and one correction, shared by the Coordinating and Administration
 * workspaces. A coordinator proposes; a different coordinator of the cohort, or an administrator, approves.
 */

const outcome = (value: string) => OUTCOME_LABELS[value as "competent" | "not_yet_competent"] ?? value;

export interface CorrectionListRow {
  correction_id: string;
  cohort_name: string;
  learner_name: string;
  learner_number: string | null;
  item_title: string;
  current_outcome: string;
  proposed_outcome: string;
  proposed_by_name: string;
  proposed_at: string;
  state: string;
  concluded_by_name: string | null;
  concluded_at: string | null;
  mine: boolean;
  may_conclude: boolean;
}

export function CorrectionsTable({ rows, base }: { rows: CorrectionListRow[]; base: string }) {
  if (rows.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="pencil" title="No corrections">
          <p>A correction proposed by a coordinator appears here until a second person approves or declines it.</p>
        </EmptyState>
      </div>
    );
  }
  return (
    <DataTable
      caption="Corrections, waiting ones first, newest first. Times in SAST."
      columns={[
        {
          key: "learner",
          header: "Learner and item",
          primary: true,
          cell: (row) => (
            <>
              <span className="table__primary">
                {row.learner_name}, {row.item_title}
              </span>
              <span className="table__secondary">{row.cohort_name}</span>
            </>
          ),
        },
        {
          key: "change",
          header: "Correction",
          cell: (row) => `${outcome(row.current_outcome)} to ${outcome(row.proposed_outcome)}`,
        },
        {
          key: "proposed",
          header: "Proposed (SAST)",
          cell: (row) => (
            <>
              {formatDateTime(row.proposed_at)}
              <span className="table__secondary">{row.mine ? "By you" : row.proposed_by_name}</span>
            </>
          ),
        },
        {
          key: "state",
          header: "State",
          cell: (row) => (
            <>
              <Tag tone={correctionTone(row.state)}>{CORRECTION_STATE_LABELS[row.state] ?? row.state}</Tag>
              {row.concluded_by_name && row.concluded_at ? (
                <span className="table__secondary">
                  {row.concluded_by_name}, {formatDateTime(row.concluded_at)}
                </span>
              ) : null}
            </>
          ),
        },
        {
          key: "open",
          header: "Actions",
          actions: true,
          cell: (row) => (
            <ButtonLink
              href={`${base}/${row.correction_id}`}
              size="sm"
              variant={row.may_conclude ? "primary" : "secondary"}
            >
              {row.may_conclude ? "Review" : "Open"}
              <span className="u-visually-hidden">
                {" "}
                the correction for {row.learner_name}, {row.item_title}
              </span>
            </ButtonLink>
          ),
        },
      ]}
      rowKey={(row) => row.correction_id}
      rows={rows}
    />
  );
}

export interface CorrectionDetailRow {
  correction_id: string;
  cohort_name: string;
  learner_name: string;
  learner_number: string | null;
  item_title: string;
  state: string;
  proposed_by_name: string;
  proposed_at: string;
  proposed_outcome: string;
  justification: string;
  reason: string;
  remediation: string | null;
  resubmission_days: number | null;
  corrected_outcome: string;
  corrected_decided_by_name: string | null;
  corrected_decided_at: string;
  corrected_decision_type: string;
  corrected_released_at: string | null;
  result_changed: boolean;
  concluded_by_name: string | null;
  concluded_at: string | null;
  conclusion_reason: string | null;
  mine: boolean;
  may_conclude: boolean;
  cannot_conclude_because: string | null;
}

export function CorrectionDetail({
  correction,
  base,
  workspace,
  appealWindowDays,
  flash,
}: {
  correction: CorrectionDetailRow;
  base: string;
  workspace: string;
  appealWindowDays: number;
  flash: { proposed?: string; concluded?: string };
}) {
  const open = correction.state === "proposed";
  return (
    <div className="page">
      <PageHeader
        lead={`${correction.learner_name}${correction.learner_number ? ` · ${correction.learner_number}` : ""} · ${correction.item_title} · ${correction.cohort_name}`}
        meta={
          <Tag tone={correctionTone(correction.state)}>
            {CORRECTION_STATE_LABELS[correction.state] ?? correction.state}
          </Tag>
        }
        title={`Correction: ${outcome(correction.corrected_outcome)} to ${outcome(correction.proposed_outcome)}`}
        workspace={workspace}
      />
      <div className="stack stack--lg">
        {flash.proposed ? (
          <Banner compact role="status" title="Correction proposed" tone="positive">
            <p>
              The cohort&rsquo;s other coordinators have been told. Nothing changes for the learner until a second
              person approves it.
            </p>
          </Banner>
        ) : null}
        {flash.concluded === "approve" ? (
          <Banner compact role="status" title="Approved and released" tone="positive">
            <p>
              {correction.learner_name} has been told their result was corrected, and has {appealWindowDays} days from
              today to appeal it. The earlier decision stays on record.
            </p>
          </Banner>
        ) : flash.concluded === "decline" ? (
          <Banner compact role="status" title="Declined" tone="positive">
            <p>The released outcome stands. The proposer has been told why.</p>
          </Banner>
        ) : flash.concluded === "withdrawn" ? (
          <Banner compact role="status" title="Withdrawn" tone="positive">
            <p>The released outcome stands. The proposal stays on record as withdrawn.</p>
          </Banner>
        ) : null}

        <div className="grid grid--2">
          <section aria-labelledby="current-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="current-h">
                The decision it corrects
              </h2>
            </div>
            <div className="card__body">
              <dl className="dl">
                <div className="dl__row">
                  <dt>Outcome</dt>
                  <dd>{outcome(correction.corrected_outcome)}</dd>
                </div>
                <div className="dl__row">
                  <dt>Decided</dt>
                  <dd>
                    {formatDateTime(correction.corrected_decided_at)} (SAST)
                    {correction.corrected_decided_by_name ? ` by ${correction.corrected_decided_by_name}` : ""},{" "}
                    {correction.corrected_decision_type === "correction"
                      ? "an earlier correction"
                      : `${correction.corrected_decision_type} decision`}
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Released</dt>
                  <dd>
                    {correction.corrected_released_at
                      ? `${formatDateTime(correction.corrected_released_at)} (SAST)`
                      : "Not recorded"}
                  </dd>
                </div>
              </dl>
            </div>
          </section>
          <section aria-labelledby="proposed-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="proposed-h">
                The proposed correction
              </h2>
            </div>
            <div className="card__body">
              <dl className="dl">
                <div className="dl__row">
                  <dt>Outcome</dt>
                  <dd>{outcome(correction.proposed_outcome)}</dd>
                </div>
                <div className="dl__row">
                  <dt>Proposed</dt>
                  <dd>
                    {formatDateTime(correction.proposed_at)} (SAST) by{" "}
                    {correction.mine ? "you" : correction.proposed_by_name}
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Why the released outcome was wrong</dt>
                  <dd className="whitespace-pre-line">{correction.reason}</dd>
                </div>
                <div className="dl__row">
                  <dt>Justification (the learner reads this)</dt>
                  <dd className="whitespace-pre-line">{correction.justification}</dd>
                </div>
                {correction.remediation ? (
                  <div className="dl__row">
                    <dt>What the learner must do</dt>
                    <dd>
                      {correction.remediation} Resubmission period: {correction.resubmission_days} days from release.
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </section>
        </div>

        {!open ? (
          <section aria-labelledby="outcome-h" className="card card--sunken">
            <div className="card__header">
              <h2 className="card__title" id="outcome-h">
                {CORRECTION_STATE_LABELS[correction.state]}
              </h2>
            </div>
            <div className="card__body">
              <p>
                {correction.concluded_by_name ?? "Someone"}
                {correction.concluded_at ? `, ${formatDateTime(correction.concluded_at)} (SAST)` : ""}.
                {correction.conclusion_reason ? ` "${correction.conclusion_reason}"` : ""}
              </p>
            </div>
          </section>
        ) : correction.may_conclude ? (
          <section aria-labelledby="decide-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="decide-h">
                Approve or decline
              </h2>
            </div>
            <div className="card__body stack">
              <p className="text-small text-muted">
                You are the second person under dual control. You took no decision on this result.
              </p>
              <ConcludeCorrectionForm
                base={base}
                consequence={approveConsequence(
                  correction.learner_name,
                  outcome(correction.proposed_outcome),
                  appealWindowDays,
                )}
                correctionId={correction.correction_id}
              />
            </div>
          </section>
        ) : (
          <section aria-labelledby="blocked-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="blocked-h">
                Waiting for a second person
              </h2>
            </div>
            <div className="card__body stack">
              <p>
                {CANNOT_CONCLUDE_TEXT[correction.cannot_conclude_because ?? ""] ??
                  "Another coordinator of the cohort, or an administrator, must approve it."}
              </p>
              {correction.mine ? <WithdrawCorrectionForm correctionId={correction.correction_id} /> : null}
            </div>
          </section>
        )}

        <p>
          <TextLink href={base}>All corrections</TextLink>
        </p>
      </div>
    </div>
  );
}
