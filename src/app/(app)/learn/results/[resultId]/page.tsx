import Link from "next/link";

export const metadata = { title: "Your result for Task 3" };

// Ported from docs/design/ui/prototype/learn-result.html (default state). Static shell: no data or behaviour yet.
export default function LearnResultPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/learn">Home</Link>
              </li>
              <li>
                <Link href="/learn/results/task-3">Results</Link>
              </li>
              <li aria-current="page">Task 3</li>
            </ol>
          </nav>
          <h1 className="page-header__title">
            <span>Your result for Task 3</span>
          </h1>
          <div className="page-header__meta">
            <span>Task 3: Workplace records portfolio</span>
            <span>Unit 3: Workplace records · 8 credits</span>
          </div>
        </header>
        {/* ============================ Released result: three variants ============================ */}
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            <article className="result" aria-labelledby="res-h">
              <div className="result__head">
                <div className="result__outcome">
                  <p className="text-overline" id="res-h">
                    Task 3: Workplace records portfolio · Unit 3
                  </p>
                  <span className="tag tag--caution tag--lg">Not yet competent</span>{" "}
                </div>
                <div className="result__marks">
                  <p className="text-figure">
                    5<span className="stat__unit"> of 8</span>
                  </p>
                  <p className="text-small text-muted">Not yet competent</p>
                </div>
              </div>
              <div className="result__body">
                {/* Next step, straight after the outcome (Not yet competent is never left without one) */}
                <div className="banner banner--caution">
                  <svg className="icon banner__icon" aria-hidden="true">
                    <use href="#i-refresh" />
                  </svg>
                  <p className="banner__title">Here is what to do next</p>
                  <div className="banner__body">
                    <p>
                      Some criteria still need evidence. You can resubmit{" "}
                      <strong>until the end of Tuesday 6 October 2026</strong>.{" "}
                      <span className="mono">13 days left</span>
                    </p>
                    <ul className="prose">
                      <li>Upload the access register for July and August.</li>
                      <li>Add one paragraph on who approves a request to see a confidential record.</li>
                    </ul>
                  </div>
                  <div className="banner__actions">
                    <Link className="btn btn--primary" href="/learn/tasks/task-3">
                      Start your resubmission
                    </Link>
                  </div>
                </div>
                {/* The appeal clock: on the page, never behind a click (SRS 5.3) */}
                <p className="deadline-line">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-clock" />
                  </svg>
                  <span>
                    You can appeal this result{" "}
                    <span className="deadline-line__date">until the end of Tuesday 29 September 2026</span>.{" "}
                    <span className="deadline-line__left">6 days left</span>, including weekends and public holidays.
                  </span>
                </p>
                <p>
                  <Link className="btn btn--secondary" href="/learn/results/task-3/appeal/new">
                    Appeal this result
                  </Link>
                </p>
                <section aria-labelledby="marks-h">
                  <h2 className="text-subheading u-mb-4" id="marks-h">
                    Marks for each criterion
                  </h2>
                  <div className="table-wrap">
                    <table className="table table--cards">
                      <caption className="u-visually-hidden">
                        Marks for each criterion of Task 3, with your assessor&apos;s comments
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Criterion</th>
                          <th scope="col">Level</th>
                          <th scope="col" className="table__num">
                            Mark
                          </th>
                          <th scope="col">Assessor&apos;s comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="table__primary-cell" data-label="Criterion">
                            <span className="table__primary">Maintains a filing index that others can use</span>
                            <span className="table__secondary mono">AC 3.1</span>
                          </td>
                          <td data-label="Level">
                            <span className="tag tag--positive">Meets</span>
                          </td>
                          <td className="table__num" data-label="Mark">
                            3 of 4
                          </td>
                          <td data-label="Comment">Every sampled record was found from the index.</td>
                        </tr>
                        <tr>
                          <td className="table__primary-cell" data-label="Criterion">
                            <span className="table__primary">Controls access to confidential records</span>
                            <span className="table__secondary mono">AC 3.2</span>
                          </td>
                          <td data-label="Level">
                            <span className="tag tag--caution">Partly</span>
                          </td>
                          <td className="table__num" data-label="Mark">
                            2 of 4
                          </td>
                          <td data-label="Comment">
                            The access register is described on page 6 but is not among the evidence files.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="u-mt-4">
                    <strong>Total: 5 of 8. Outcome: Not yet competent.</strong>{" "}
                    <span className="text-muted">
                      Both criteria must be at &quot;Meets&quot; or higher for a Competent outcome.
                    </span>
                  </p>
                </section>
                <section aria-labelledby="feedback-h">
                  <h2 className="text-subheading" id="feedback-h">
                    Feedback from your assessor, Thandiwe Nkosi
                  </h2>
                  <div className="prose u-mt-2">
                    <p>
                      Lerato, your filing index is clear and every record in the sample can be found from it. The
                      retention schedule is correct for payroll and leave records.
                    </p>
                    <p>
                      To meet criterion 3.2 you still need to show how access to confidential records is controlled: add
                      the access register you describe on page 6 and explain who approves a request.
                    </p>
                  </div>
                </section>
              </div>
              <div className="result__footer">
                Released on 22 September 2026 at 14:05 (SAST). You were told in the LMS at 14:05 and by email at 14:06
                (delivered).
              </div>
            </article>
          </div>
          <aside className="page-layout__aside stack" aria-label="How you were told, and the work that was assessed">
            <details className="delivery-evidence" open>
              <summary>How you were told</summary>
              <ul className="delivery-evidence__list">
                <li className="delivery-evidence__row">
                  <span className="delivery-evidence__channel">In the LMS</span>
                  <time className="delivery-evidence__time" dateTime="2026-09-22T14:05:00+02:00">
                    22 Sep 2026, 14:05
                  </time>
                </li>
                <li className="delivery-evidence__row">
                  <span className="delivery-evidence__channel">Email to l.mokoena@example.org: delivered</span>
                  <time className="delivery-evidence__time" dateTime="2026-09-22T14:06:00+02:00">
                    22 Sep 2026, 14:06
                  </time>
                </li>
                <li className="delivery-evidence__row">
                  <span className="delivery-evidence__channel">First opened by you</span>
                  <time className="delivery-evidence__time" dateTime="2026-09-22T18:31:00+02:00">
                    22 Sep 2026, 18:31
                  </time>
                </li>
              </ul>
            </details>
            <p className="text-small text-muted">
              Your 7 days to appeal are counted from the day you were told: Tuesday 22 September 2026. Times are South
              African time.
            </p>
            <div className="card">
              <div className="card__header">
                <h2 className="card__title">The work that was assessed</h2>
              </div>
              <div className="card__body">
                <dl className="dl">
                  <div className="dl__row">
                    <dt>Version</dt>
                    <dd>
                      Version 2 <span className="tag tag--caution">Late</span>
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Submitted</dt>
                    <dd>
                      <time dateTime="2026-09-04T17:42:00+02:00">Friday 4 September 2026 at 17:42 (SAST)</time>
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Receipt</dt>
                    <dd className="mono">SUB-2026-0904-7K2M</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Assessor</dt>
                    <dd>Thandiwe Nkosi</dd>
                  </div>
                </dl>
              </div>
              <div className="card__footer">
                <Link href="/learn/tasks/task-3">Open the task and your versions</Link>
              </div>
            </div>
          </aside>
        </div>
        {/* ============================ Still being assessed: no outcome, no marks, no dates that hint at one ============================ */}
      </div>
    </>
  );
}
