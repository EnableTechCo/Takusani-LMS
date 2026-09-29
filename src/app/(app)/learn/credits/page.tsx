import type { CSSProperties } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDayOf } from "@/lib/dates";
import { getMyCredits, listMyCreditHistory } from "@/modules/credits/record-queries";
import {
  ITEM_STATE_LABELS,
  byProgramme,
  historyLine,
  itemNote,
  summarySentence,
  unitStatus,
  type CreditProgramme,
  type CreditUnitRow,
} from "@/modules/credits/record-rules";

export const metadata = { title: "Credits" };

// L-19 (P0-09; FR-318, FR-801 to FR-804; P-07): credits earned of the qualification's total, each unit earned or
// outstanding with the assessments that count, and the ledger history, which only ever gains lines (FR-803). A result
// not released yet reads "Being assessed" with no credit value (FR-804).
export default async function LearnCreditsPage() {
  const [rows, history] = await Promise.all([getMyCredits(), listMyCreditHistory()]);
  const programmes = byProgramme(rows);
  const now = new Date();
  const first = programmes[0];

  return (
    <div className="page">
      <PageHeader
        lead={
          first
            ? programmes.length === 1
              ? summarySentence(first)
              : programmes.map((programme) => `${programme.title}: ${summarySentence(programme)}`).join(" ")
            : "You are not enrolled in a programme yet, so there are no credits to show."
        }
        title="Your credits"
        workspace="Learning"
      />
      {first ? (
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            {programmes.map((programme) => (
              <ProgrammeCredits key={programme.programmeId} now={now} programme={programme} />
            ))}
          </div>
          <aside aria-label="Credit history and notes" className="page-layout__aside stack">
            <section aria-labelledby="history-h">
              <h2 className="text-subheading u-mb-4" id="history-h">
                Credit history
              </h2>
              {history.length > 0 ? (
                <>
                  <ol
                    aria-label="Credit history, newest first. Dates are South African time."
                    className="log log--boxed"
                  >
                    {history.map((row) => {
                      const line = historyLine(row);
                      return (
                        <li className="log__item" key={row.entry_id}>
                          <time className="log__time" dateTime={row.created_at}>
                            {formatDayOf(row.created_at)}
                          </time>
                          <div className="log__event">
                            <span className="log__actor">{line.amount}</span> {row.unit_code}: {row.unit_title}
                            <div className="log__detail">{line.detail}</div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  <p className="text-small text-muted u-mt-2">
                    A line is added each time credits are awarded. If an appeal or a correction changes an outcome, a
                    new line is added. Earlier lines are never changed or removed.
                  </p>
                </>
              ) : (
                <p className="text-small text-muted">
                  Nothing here yet. Every time credits are awarded, a line is added with the date. Lines are never
                  changed or removed.
                </p>
              )}
            </section>
            <Banner
              compact
              role="note"
              title="This page is a record of credits. It is not a certificate or a statement of results."
              tone="info"
            />
          </aside>
        </div>
      ) : (
        <div className="card">
          <EmptyState icon="chart" title="No programme yet">
            <p>When you are enrolled in a programme, its units and credits appear here.</p>
          </EmptyState>
        </div>
      )}
    </div>
  );
}

function ProgrammeCredits({ programme, now }: { programme: CreditProgramme; now: Date }) {
  const percent = programme.total > 0 ? Math.round((programme.earned / programme.total) * 1000) / 10 : 0;
  const heading = `${programme.title}${programme.nqfLevel ? `, NQF Level ${programme.nqfLevel}` : ""}`;
  const id = programme.programmeId;
  return (
    <div className="stack stack--lg">
      <section aria-labelledby={`progress-${id}`} className="card">
        <div className="card__header">
          <h2 className="card__title" id={`progress-${id}`}>
            Progress toward your qualification
          </h2>
        </div>
        <div className="card__body">
          <p className="text-small text-muted">
            {heading} · {programme.cohortName}
            {programme.cohortArchived ? " (archived: this record is kept, and no longer changes)" : ""}
          </p>
          <div className="credits u-mt-4">
            <p className="credits__figure">
              {programme.earned} <span className="credits__of">of {programme.total} credits earned</span>
            </p>
            <div
              aria-label={`${programme.earned} credits earned, ${programme.outstanding} outstanding, of ${programme.total}`}
              className="credits__bar"
              role="img"
            >
              {programme.earned > 0 ? (
                <span
                  className="credits__segment credits__segment--earned"
                  style={{ "--value": `${percent}%` } as CSSProperties}
                />
              ) : null}
              {programme.outstanding > 0 ? <span className="credits__segment credits__segment--outstanding" /> : null}
            </div>
            <ul className="credits__legend">
              <li className="credits__key credits__key--earned">
                <strong>{programme.earned}</strong> earned
                {programme.earnedUnits.length > 0
                  ? ` (${programme.earnedUnits.length} ${programme.earnedUnits.length === 1 ? "unit" : "units"})`
                  : ""}
              </li>
              <li className="credits__key">
                <strong>{programme.outstanding}</strong> outstanding ({programme.outstandingUnits.length}{" "}
                {programme.outstandingUnits.length === 1 ? "unit" : "units"})
              </li>
            </ul>
          </div>
          <p className="text-small text-muted u-mt-4">
            You earn the credits for a unit when a Competent result has been released for every assessment in that unit.
            Work that is still being assessed is not part of this total, and has no credit value until its result is
            released.
          </p>
        </div>
      </section>

      {programme.earnedUnits.length > 0 ? (
        <section aria-labelledby={`earned-${id}`} className="stack">
          <div className="section__header">
            <h2 className="text-heading" id={`earned-${id}`}>
              Units you have earned
            </h2>
            <span className="text-meta">{programme.earned} credits</span>
          </div>
          <UnitsTable
            caption="Units you have earned, with the credits, the date they were awarded and the assessments that counted"
            itemsHeader="Assessments that counted"
            now={now}
            units={programme.earnedUnits}
          />
        </section>
      ) : (
        <section aria-labelledby={`earned-${id}`} className="card">
          <div className="card__header">
            <h2 className="card__title" id={`earned-${id}`}>
              Units you have earned
            </h2>
          </div>
          <EmptyState icon="chart" title="No units earned yet">
            <p>A unit appears here on the day its last Competent result is released.</p>
          </EmptyState>
        </section>
      )}

      {programme.outstandingUnits.length > 0 ? (
        <section aria-labelledby={`outstanding-${id}`} className="stack">
          <div className="section__header">
            <h2 className="text-heading" id={`outstanding-${id}`}>
              Units still outstanding
            </h2>
            <span className="text-meta">{programme.outstanding} credits</span>
          </div>
          <UnitsTable
            caption="Units still outstanding, with the credits each is worth, how far you are, and the assessments that count"
            itemsHeader="Assessments that count"
            now={now}
            units={programme.outstandingUnits}
          />
        </section>
      ) : null}
    </div>
  );
}

function UnitsTable({
  units,
  caption,
  itemsHeader,
  now,
}: {
  units: CreditUnitRow[];
  caption: string;
  itemsHeader: string;
  now: Date;
}) {
  return (
    <DataTable
      caption={caption}
      columns={[
        {
          key: "unit",
          header: "Unit",
          primary: true,
          cell: (unit) => (
            <span className="table__primary">
              {unit.unit_code}: {unit.unit_title}
            </span>
          ),
        },
        {
          key: "credits",
          header: "Credits",
          numeric: true,
          cell: (unit) => (unit.credits === null ? "Not set" : unit.credits),
        },
        {
          key: "status",
          header: "Status",
          cell: (unit) => {
            const status = unitStatus(unit, now);
            return (
              <Tag shape={status.shape} tone={status.tone}>
                {status.label}
              </Tag>
            );
          },
        },
        {
          key: "items",
          header: itemsHeader,
          cell: (unit) =>
            unit.items.length === 0 ? (
              <span className="text-muted">Your coordinator has not yet set which assessments count.</span>
            ) : (
              <div className="stack stack--sm">
                {unit.items.map((item) => {
                  const note = itemNote(item, now);
                  return (
                    <div key={item.title}>
                      {item.result_id ? (
                        <TextLink href={`/learn/results/${item.result_id}`}>{item.title}</TextLink>
                      ) : (
                        item.title
                      )}
                      {" · "}
                      {item.state === "being_assessed" ? (
                        <Tag shape="half" tone="info">
                          Being assessed
                        </Tag>
                      ) : (
                        ITEM_STATE_LABELS[item.state]
                      )}
                      {note ? <span className="table__secondary">{note}</span> : null}
                    </div>
                  );
                })}
              </div>
            ),
        },
      ]}
      rowKey={(unit) => unit.unit_id}
      rows={units}
    />
  );
}
