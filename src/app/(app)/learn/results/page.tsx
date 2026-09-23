import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDayOf } from "@/lib/dates";
import { listMyResults } from "@/modules/assessment/queries";
import { appealWindow, OUTCOME_LABELS } from "@/modules/assessment/rules";

export const metadata = { title: "Results" };

type Result = Awaited<ReturnType<typeof listMyResults>>[number];

function Outcome({ result }: { result: Result }) {
  if (result.state !== "released") {
    return (
      <Tag shape="half" tone="info">
        Being assessed
      </Tag>
    );
  }
  return <Tag tone={result.outcome === "competent" ? "positive" : "caution"}>{OUTCOME_LABELS[result.outcome]}</Tag>;
}

/** The appeal closing day, or the day it closed. Nothing while the result is held: that time has not started. */
function Appeal({ result, now }: { result: Result; now: Date }) {
  if (result.state !== "released") return <span className="text-muted">Starts when it is released</span>;
  const window = appealWindow(result.appeal_deadline_at, now);
  if (window.state === "closed") return <>Closed at the end of {window.lastDay}</>;
  if (window.state === "last_day") return <strong>Today is the last day</strong>;
  return <>Until the end of {window.lastDay}</>;
}

// L-14 (FR-316): the learner's results, released first and newest first, then the ones still being assessed.
export default async function LearnResultsPage() {
  const results = await listMyResults();
  const now = new Date();

  return (
    <div className="page">
      <PageHeader
        lead="Your results, with the last day you can appeal each one. Times are SAST."
        title="Results"
        workspace="Learning"
      />
      <div className="stack stack--lg">
        {results.length === 0 ? (
          <div className="card">
            <EmptyState icon="check-circle" title="No results yet">
              <p>Work you hand in appears here while it is assessed. You will be told when its result is ready.</p>
            </EmptyState>
          </div>
        ) : (
          <DataTable
            caption="Your results: released results first, newest first, then work still being assessed."
            columns={[
              {
                key: "item",
                header: "Work",
                primary: true,
                cell: (result) => (
                  <>
                    <TextLink href={`/learn/results/${result.result_id}`}>{result.item_title}</TextLink>
                    <span className="table__secondary">{result.cohort_name}</span>
                  </>
                ),
              },
              { key: "outcome", header: "Outcome", cell: (result) => <Outcome result={result} /> },
              {
                key: "released",
                header: "Released",
                cell: (result) => (result.released_at ? formatDayOf(result.released_at) : "Not yet"),
              },
              { key: "appeal", header: "Appeal", cell: (result) => <Appeal now={now} result={result} /> },
            ]}
            rowKey={(result) => result.result_id}
            rows={results}
          />
        )}
      </div>
    </div>
  );
}
