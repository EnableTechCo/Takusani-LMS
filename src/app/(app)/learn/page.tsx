import type { CSSProperties } from "react";
import Link from "next/link";

export const metadata = { title: "Home" };

// Ported from docs/design/ui/prototype/learn-home.html (default state). Static shell: no data or behaviour yet.
export default function LearnHomePage() {
  return (
    <>
      {/* Offline: full-bleed, in the page flow, not dismissible while it is true. It does not cover content or block input. */}
      <div className="page">
        <header className="page-header">
          <p className="text-overline">
            <time dateTime="2026-09-23">Wednesday 23 September 2026</time>
          </p>
          <h1 className="page-header__title">
            <span>Good morning, Lerato</span>
          </h1>
          <p className="page-header__lead">
            Your result for Task 3 is ready, and one piece of work needs your attention.
          </p>
          <div className="page-header__meta">
            <span>Certificate in Business Administration, NQF Level 4</span>
            <span>2026 Intake B</span>
          </div>
        </header>
        {/* ================= Default and offline ================= */}
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            {/* 1. New results: only while an appeal window or a resubmission period is open */}
            <section aria-labelledby="new-results-h">
              <div className="section__header">
                <h2 className="text-heading" id="new-results-h">
                  New result
                </h2>
                <Link className="text-small" href="/learn/results/task-3">
                  All results
                </Link>
              </div>
              <article className="result" aria-labelledby="nr-1">
                <div className="result__head">
                  <div className="result__outcome">
                    <p className="text-overline" id="nr-1">
                      Task 3: Workplace records portfolio · Unit 3
                    </p>
                    <span className="tag tag--caution tag--lg">Not yet competent</span>
                  </div>
                  <p className="text-small text-muted">
                    Released <time dateTime="2026-09-22T14:05:00+02:00">22 Sep 2026, 14:05</time>
                  </p>
                </div>
                <div className="result__body">
                  <p>
                    Some criteria still need evidence. Your assessor has written down what to add.{" "}
                    <strong>You can resubmit until the end of Tuesday 6 October 2026.</strong>
                  </p>
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
                  <div className="cluster">
                    <Link className="btn btn--primary" href="/learn/results/task-3">
                      View your result and feedback
                    </Link>
                    <Link className="btn btn--secondary" href="/learn/tasks/task-3">
                      Start your resubmission
                    </Link>
                  </div>
                </div>
              </article>
            </section>
            {/* 2. Do next: overdue first, then by due date */}
            <section aria-labelledby="do-next-h">
              <div className="section__header">
                <h2 className="text-heading" id="do-next-h">
                  Do next
                </h2>
                <Link className="text-small" href="/learn/tasks/task-3">
                  All tasks
                </Link>
              </div>
              <div className="table-wrap">
                <table className="table table--cards">
                  <caption className="u-visually-hidden">
                    Work to do next, soonest first. Times are South African time.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Work</th>
                      <th scope="col">Status</th>
                      <th scope="col">Deadline (SAST)</th>
                      <th scope="col" className="table__actions">
                        <span className="u-visually-hidden">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="table__primary-cell" data-label="Work">
                        <span className="table__primary">Task 3: Workplace records portfolio</span>
                        <span className="table__secondary">Unit 3 · add the access register and one paragraph</span>
                      </td>
                      <td data-label="Status">
                        <span className="tag tag--caution">Resubmission open</span>
                      </td>
                      <td data-label="Deadline">
                        <span className="deadline">
                          <svg className="icon icon--sm" aria-hidden="true">
                            <use href="#i-clock" />
                          </svg>
                          Until the end of Tue 6 Oct 2026 · 13 days left
                        </span>
                      </td>
                      <td className="table__actions">
                        <Link className="btn btn--secondary btn--sm" href="/learn/tasks/task-3">
                          Open
                          <span className="u-visually-hidden"> Task 3</span>
                        </Link>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Work">
                        <span className="table__primary">Task 4: Meeting minutes and action list</span>
                        <span className="table__secondary">Unit 4 · set by Pieter van Wyk</span>
                      </td>
                      <td data-label="Status">
                        <span className="tag">Not started</span>
                      </td>
                      <td data-label="Deadline">
                        <span className="deadline">
                          <svg className="icon icon--sm" aria-hidden="true">
                            <use href="#i-clock" />
                          </svg>
                          Due Fri 2 Oct 2026, 17:00 · in 9 days
                        </span>
                      </td>
                      <td className="table__actions">
                        <Link className="btn btn--secondary btn--sm" href="/">
                          Open
                          <span className="u-visually-hidden"> Task 4 (not part of this prototype)</span>
                        </Link>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          {/* 3. Sessions and exam windows */}
          <aside className="page-layout__aside stack" aria-label="Sessions, deadlines and exams">
            <div className="card">
              <div className="card__header">
                <h2 className="card__title" id="coming-h">
                  Coming up
                </h2>
                <Link className="text-small" href="/">
                  Open calendar
                </Link>
              </div>
              <div className="card__body">
                <div className="agenda">
                  <section aria-labelledby="ag-1">
                    <h3 className="agenda__day-title" id="ag-1">
                      Tuesday 29 September
                    </h3>
                    <div className="agenda__item">
                      <span className="agenda__time">09:00</span>
                      <span className="agenda__title">Session 15: Office administration</span>
                      <span className="agenda__meta">
                        <span>Pieter van Wyk · 2 hours · online</span>
                        <a className="link link--standalone" href="https://teams.microsoft.com/">
                          <svg className="icon icon--sm" aria-hidden="true">
                            <use href="#i-video" />
                          </svg>
                          Join in Teams
                          <span className="u-visually-hidden"> (opens Microsoft Teams)</span>
                        </a>
                        <span>You can join from 08:50.</span>
                      </span>
                    </div>
                    <div className="agenda__item">
                      <span className="agenda__time">All day</span>
                      <span className="agenda__title">Last day to appeal: Task 3</span>
                      <span className="agenda__meta">
                        <span className="deadline deadline--soon">
                          <svg className="icon icon--sm" aria-hidden="true">
                            <use href="#i-clock" />
                          </svg>
                          Until the end of the day
                        </span>
                      </span>
                    </div>
                  </section>
                  <section aria-labelledby="ag-2">
                    <h3 className="agenda__day-title" id="ag-2">
                      Thursday 1 October
                    </h3>
                    <div className="agenda__item">
                      <span className="agenda__time">09:00</span>
                      <span className="agenda__title">Contact session at the training centre</span>
                      <span className="agenda__meta">
                        <span>Training Room 2 · 09:00 to 15:00 · lunch is provided</span>
                      </span>
                    </div>
                  </section>
                  <section aria-labelledby="ag-3">
                    <h3 className="agenda__day-title" id="ag-3">
                      Tuesday 6 October
                    </h3>
                    <div className="agenda__item">
                      <span className="agenda__time">All day</span>
                      <span className="agenda__title">Last day to resubmit: Task 3</span>
                      <span className="agenda__meta">
                        <span className="tag tag--caution">Resubmission open</span>
                      </span>
                    </div>
                  </section>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card__header">
                <h2 className="card__title" id="exam-h">
                  Exam
                </h2>
                <span className="tag">Opens Wed 14 Oct, 09:00</span>
              </div>
              <div className="card__body stack">
                <div>
                  <p className="text-subheading">Unit 5 summative exam</p>
                  <p className="text-small text-muted">Unit 5: Office administration · 2 hours · 1 attempt</p>
                </div>
                <p>
                  <time className="datetime datetime--stacked" dateTime="2026-10-14T09:00:00+02:00">
                    <span>Wednesday 14 October 2026</span>
                    <span className="datetime__time">
                      Open from 09:00 to 12:00 <span className="datetime__zone">SAST</span>
                    </span>
                  </time>
                </p>
                <p className="text-small">
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-laptop" />
                  </svg>{" "}
                  You need a laptop or desktop computer to sit this exam. A phone or tablet cannot be used. You can
                  check your device at any time before the day.
                </p>
                <Link className="btn btn--secondary" href="/learn/exams/unit-5-exam">
                  Read the exam rules and check your device
                </Link>
                <p className="text-small">
                  Need extra time, or use a screen reader or other assistive software?{" "}
                  <Link className="link" href="/learn/exams/unit-5-exam#pf-support-h">
                    Ask by the end of Wednesday 7 October 2026.
                  </Link>
                </p>
              </div>
            </div>
          </aside>
        </div>
        {/* 4 and 5. Being assessed, credits */}
        <div className="grid grid--2 section">
          <section className="card" aria-labelledby="assessed-h">
            <div className="card__header">
              <h2 className="card__title" id="assessed-h">
                Being assessed
              </h2>
            </div>
            <div className="card__body stack">
              <div className="cluster cluster--between">
                <div>
                  <p className="text-subheading">Unit 2 summative exam</p>
                  <p className="text-small text-muted">
                    Unit 2: Business numeracy · submitted{" "}
                    <time dateTime="2026-09-02T10:58:00+02:00">2 Sep 2026, 10:58</time>
                  </p>
                </div>
                <span className="tag tag--info tag--shape-half">Being assessed</span>
              </div>
              <div className="banner banner--info banner--compact" role="note">
                <svg className="icon banner__icon" aria-hidden="true">
                  <use href="#i-info" />
                </svg>
                <p className="banner__title">We have your work</p>
                <p className="banner__body">
                  In this programme, results are checked by a second person (a moderator) before anyone sees them, and
                  everyone&apos;s results for the same exam or task are released together. You will get a message here
                  and by email when your result is ready. Your 7 days to appeal, and any time you are given to resubmit,
                  only start on the day your result is released.
                </p>
              </div>
            </div>
          </section>
          <section className="card" aria-labelledby="credits-h">
            <div className="card__header">
              <h2 className="card__title" id="credits-h">
                Progress toward your qualification
              </h2>
              <Link className="text-small" href="/learn/credits">
                Credits record
              </Link>
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
                    <strong>52</strong> earned
                  </li>
                  <li className="credits__key">
                    <strong>88</strong> outstanding
                  </li>
                </ul>
                <p className="text-small text-muted">
                  Credits are counted when a Competent result is released. Work that is still being assessed is not part
                  of this total.
                </p>
              </div>
            </div>
          </section>
        </div>
        {/* ================= First day: nothing due, nothing assessed, nothing earned ================= */}
      </div>
    </>
  );
}
