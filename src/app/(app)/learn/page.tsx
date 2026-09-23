import { TextLink } from "@/components/ui/link";
import { OfflineBanner } from "@/components/ui/offline-banner";
import { EmptyState } from "@/components/ui/status";
import { formatLongDayOf } from "@/lib/dates";
import { listMyResults } from "@/modules/assessment/queries";
import { requireActiveAccess } from "@/modules/identity/session";
import { BeingAssessedCard, DoNextTable, NewResultCard } from "@/modules/learning/home";
import {
  beingAssessed,
  doNext,
  firstName,
  greeting,
  newResults,
  summaryLine,
  type HomeResult,
  type HomeTask,
} from "@/modules/learning/home-rules";
import { listMyEnrolments } from "@/modules/programmes/queries";
import { listMyTasks } from "@/modules/submissions/queries";

export const metadata = { title: "Home" };

// L-01 (P0-03; FR-304, FR-305, FR-316, FR-317): what needs the learner now, in one screen. MVP blocks: new results,
// do next and being assessed. Sessions, the exam window and credits join when those features ship (S2-12).
export default async function LearnHomePage() {
  const [access, tasks, results, enrolments] = await Promise.all([
    requireActiveAccess(),
    listMyTasks() as Promise<HomeTask[]>,
    listMyResults() as Promise<HomeResult[]>,
    listMyEnrolments(),
  ]);
  const now = new Date();
  const fresh = newResults(results, tasks, now);
  const todo = doNext(tasks, results, now);
  const assessed = beingAssessed(tasks, results);
  const name = firstName(access.full_name);
  const firstDay = tasks.length === 0 && results.length === 0;
  const enrolment = enrolments[0];
  const programme = enrolment
    ? `${enrolment.programme_title}${enrolment.nqf_level ? `, NQF Level ${enrolment.nqf_level}` : ""}`
    : null;

  return (
    <>
      <OfflineBanner renderedAt={now.toISOString()} />
      <div className="page">
        <header className="page-header">
          <p className="text-overline">
            <time dateTime={now.toISOString()}>{formatLongDayOf(now.toISOString())}</time>
          </p>
          <h1 className="page-header__title">{firstDay ? `Welcome, ${name}` : `${greeting(now)}, ${name}`}</h1>
          <p className="page-header__lead">
            {firstDay
              ? enrolment
                ? `You are enrolled in ${programme} with ${enrolment.cohort_name}. Nothing is due yet. This page will always show what to do next.`
                : "Nothing is due yet. This page will always show what to do next."
              : summaryLine(fresh, todo)}
          </p>
          {enrolment && !firstDay ? (
            <div className="page-header__meta">
              <span>{programme}</span>
              {enrolments.map((row) => (
                <span key={row.cohort_id}>{row.cohort_name}</span>
              ))}
            </div>
          ) : null}
        </header>

        <div className="stack stack--lg">
          {fresh.length > 0 ? (
            <section aria-labelledby="new-results-h" className="stack">
              <div className="section__header">
                <h2 className="text-heading" id="new-results-h">
                  {fresh.length === 1 ? "New result" : "New results"}
                </h2>
                <TextLink href="/learn/results">All results</TextLink>
              </div>
              {fresh.map((item) => (
                <NewResultCard item={item} key={item.result.result_id} now={now} />
              ))}
            </section>
          ) : null}

          <section aria-labelledby="do-next-h" className="stack">
            <div className="section__header">
              <h2 className="text-heading" id="do-next-h">
                Do next
              </h2>
              <TextLink href="/learn/tasks">All tasks</TextLink>
            </div>
            {todo.length > 0 ? (
              <DoNextTable items={todo} now={now} />
            ) : (
              <div className="card">
                <EmptyState icon="check-circle" title="Nothing to hand in right now">
                  <p>When new work is set for you, it appears here with its due date.</p>
                </EmptyState>
              </div>
            )}
          </section>

          {assessed.length > 0 ? <BeingAssessedCard items={assessed} /> : null}
        </div>
      </div>
    </>
  );
}
