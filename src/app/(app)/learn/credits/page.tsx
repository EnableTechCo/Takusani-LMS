import type { CSSProperties } from "react";
import Link from "next/link";

export const metadata = { title: "Credits" };

// Ported from docs/design/ui/prototype/learn-credits.html (default state). Static shell: no data or behaviour yet.
export default function LearnCreditsPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/learn">Home</Link>
              </li>
              <li aria-current="page">Credits</li>
            </ol>
          </nav>
          <h1 className="page-header__title">Your credits</h1>
          <p className="page-header__lead">You have earned 52 of 140 credits. 88 credits are still outstanding.</p>
          <div className="page-header__meta">
            <span>Certificate in Business Administration, NQF Level 4</span>
            <span>2026 Intake B</span>
          </div>
        </header>
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            {/* ============ Progress toward the qualification ============ */}
            <section className="card" aria-labelledby="progress-h">
              <div className="card__header">
                <h2 className="card__title" id="progress-h">
                  Progress toward your qualification
                </h2>
              </div>
              <div className="card__body">
                <div className="credits">
                  <p className="credits__figure">
                    52 <span className="credits__of">of 140 credits earned</span>
                  </p>
                  <div className="credits__bar" role="img" aria-label="52 credits earned, 88 outstanding, of 140">
                    <span
                      className="credits__segment credits__segment--earned"
                      style={{ "--value": "37.1%" } as CSSProperties}
                    />
                    <span className="credits__segment credits__segment--outstanding" />
                  </div>
                  <ul className="credits__legend">
                    <li className="credits__key credits__key--earned">
                      <strong>52</strong> earned (3 units)
                    </li>
                    <li className="credits__key">
                      <strong>88</strong> outstanding (6 units)
                    </li>
                  </ul>
                </div>
                <p className="text-small text-muted u-mt-4">
                  You earn the credits for a unit when a Competent result has been released for every assessment in that
                  unit. Work that is still being assessed is not part of this total, and has no credit value until its
                  result is released.
                </p>
              </div>
            </section>
            {/* ============ Earned units ============ */}
            <section aria-labelledby="earned-h">
              <div className="section__header">
                <h2 className="text-heading" id="earned-h">
                  Units you have earned
                </h2>
                <span className="text-meta">52 credits</span>
              </div>
              <div className="table-wrap">
                <table className="table table--cards">
                  <caption className="u-visually-hidden">
                    Units you have earned, with the credits, the date they were awarded and the assessments that counted
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Unit</th>
                      <th scope="col" className="table__num">
                        Credits
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">Assessments that counted</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 1: Workplace orientation and conduct</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        12
                      </td>
                      <td data-label="Status">
                        <span className="tag tag--positive">Earned on 14 Jul 2026</span>
                      </td>
                      <td data-label="Assessments">
                        <div>Task 1: Workplace conduct case study · Competent</div>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 6: Computer skills for the office</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        24
                      </td>
                      <td data-label="Status">
                        <span className="tag tag--positive">Earned on 11 Aug 2026</span>
                      </td>
                      <td data-label="Assessments">
                        <div>
                          Practical 1: Documents and spreadsheets · Competent
                          <br />
                          Practical 2: Email and calendar · Competent
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 7: Customer service</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        16
                      </td>
                      <td data-label="Status">
                        <span className="tag tag--positive">Earned on 21 Aug 2026</span>
                      </td>
                      <td data-label="Assessments">
                        <div>Role play: Handling a customer query · Competent</div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            {/* ============ Outstanding units ============ */}
            <section aria-labelledby="outstanding-h">
              <div className="section__header">
                <h2 className="text-heading" id="outstanding-h">
                  Units still outstanding
                </h2>
                <span className="text-meta">88 credits</span>
              </div>
              <div className="table-wrap">
                <table className="table table--cards">
                  <caption className="u-visually-hidden">
                    Units still outstanding, with the credits each is worth, how far you are, and the assessments that
                    count
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Unit</th>
                      <th scope="col" className="table__num">
                        Credits
                      </th>
                      <th scope="col">Status</th>
                      <th scope="col">Assessments that count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 2: Business numeracy</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        16
                      </td>
                      <td data-label="Status">
                        <span className="tag tag--info tag--shape-half">In progress: 1 of 2 assessments Competent</span>
                      </td>
                      <td data-label="Assessments">
                        <div>
                          Numeracy workbook · Competent
                          <br />
                          Unit 2 summative exam · <span className="tag tag--info tag--shape-half">Being assessed</span>
                          <span className="table__secondary">No credit value until the result is released.</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 3: Workplace records</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        8
                      </td>
                      <td data-label="Status">
                        <span className="tag tag--caution">Resubmission open</span>
                      </td>
                      <td data-label="Assessments">
                        <div>
                          <Link href="/learn/results/task-3">Task 3: Workplace records portfolio</Link> · Not yet
                          competent
                          <span className="table__secondary">
                            You can resubmit until the end of Tuesday 6 October 2026.
                          </span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 4: Business communication</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        10
                      </td>
                      <td data-label="Status">
                        <span className="tag tag--info tag--shape-half">In progress: 1 of 2 assessments Competent</span>
                      </td>
                      <td data-label="Assessments">
                        <div>
                          Task 2: Business letters · Competent
                          <br />
                          Task 4: Meeting minutes and action list · Not started
                          <span className="table__secondary">Due Friday 2 October 2026 at 17:00.</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 5: Office administration</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        14
                      </td>
                      <td data-label="Status">
                        <span className="tag">Not started</span>
                      </td>
                      <td data-label="Assessments">
                        <div>
                          <Link href="/learn/exams/unit-5-exam">Unit 5 summative exam</Link>
                          <span className="table__secondary">Opens Wednesday 14 October 2026 at 09:00.</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 8: Bookkeeping basics</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        12
                      </td>
                      <td data-label="Status">
                        <span className="tag">Not started</span>
                      </td>
                      <td data-label="Assessments">
                        <div>
                          Task 5 and the Unit 8 summative exam
                          <span className="table__secondary">Dates will be set in Term 4.</span>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Unit">
                        <span className="table__primary">Unit 9: Workplace project</span>
                      </td>
                      <td className="table__num" data-label="Credits">
                        28
                      </td>
                      <td data-label="Status">
                        <span className="tag">Not started</span>
                      </td>
                      <td data-label="Assessments">
                        <div>
                          Project portfolio and presentation
                          <span className="table__secondary">Dates will be set in Term 4.</span>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          {/* ============ Aside: credit history (append-only) and what this page is not ============ */}
          <aside className="page-layout__aside stack" aria-label="Credit history and notes">
            <section aria-labelledby="history-h">
              <h2 className="text-subheading u-mb-4" id="history-h">
                Credit history
              </h2>
              <ol className="log log--boxed" aria-label="Credit history, newest first. Dates are South African time.">
                <li className="log__item">
                  <time className="log__time" dateTime="2026-08-21">
                    21 Aug 2026
                  </time>
                  <div className="log__event">
                    <span className="log__actor">+16 credits</span> Unit 7: Customer service
                    <div className="log__detail">award · total 52</div>
                  </div>
                </li>
                <li className="log__item">
                  <time className="log__time" dateTime="2026-08-11">
                    11 Aug 2026
                  </time>
                  <div className="log__event">
                    <span className="log__actor">+24 credits</span> Unit 6: Computer skills for the office
                    <div className="log__detail">award · total 36</div>
                  </div>
                </li>
                <li className="log__item">
                  <time className="log__time" dateTime="2026-07-14">
                    14 Jul 2026
                  </time>
                  <div className="log__event">
                    <span className="log__actor">+12 credits</span> Unit 1: Workplace orientation and conduct
                    <div className="log__detail">award · total 12</div>
                  </div>
                </li>
              </ol>
              <p className="text-small text-muted u-mt-2">
                A line is added each time credits are awarded. If an appeal changes an outcome, a new line is added.
                Earlier lines are never changed or removed.
              </p>
            </section>
            <div className="banner banner--info banner--compact" role="note">
              <svg className="icon banner__icon" aria-hidden="true">
                <use href="#i-info" />
              </svg>
              <p className="banner__body">
                This page is a record of credits. It is not a certificate or a statement of results.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
