import Link from "next/link";
import "./page.css";

export const metadata = { title: "Submissions · Teaching" };

// Ported from docs/design/ui/prototype/teach-submissions.html (default state). Static shell: no data or behaviour yet.
export default function TeachSubmissionsPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <a href="#main">Teaching</a>
              </li>
              <li aria-current="page">Submissions</li>
            </ol>
          </nav>
          <p className="page-header__workspace">Teaching</p>
          <h1 className="page-header__title">Submissions</h1>
          <p className="page-header__lead">
            Who has submitted, who has not, and who was late. You see submission status only: outcomes and marks are not
            shown to facilitators.
          </p>
          <div className="page-header__meta">
            <span>
              2026 Intake B <span className="tag tag--plain">Moderated</span> · 96 learners
            </span>
            <span className="text-meta">As at Mon 7 Sep 2026, 08:40 SAST</span>
          </div>
          <div className="page-header__actions">
            <button
              type="button"
              className="btn btn--secondary"
              data-toast="Export ready: task-submissions-2026-intake-b.csv"
              data-toast-meta="Rows for the current filter · 7 Sep 2026, 08:40"
            >
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-download" />
              </svg>
              Export CSV
            </button>
          </div>
        </header>
        {/* Per task: submitted / late / outstanding */}
        <section aria-labelledby="tasks-h">
          <div className="section__header">
            <h2 className="text-heading" id="tasks-h">
              By task
            </h2>
            <span className="text-small text-muted">Submitted means on time. Late work is counted separately.</span>
          </div>
          <div className="table-wrap">
            <table className="table table--cards">
              <caption className="u-visually-hidden">Submission counts for each task in 2026 Intake B</caption>
              <thead>
                <tr>
                  <th scope="col">Task</th>
                  <th scope="col">Due (SAST)</th>
                  <th scope="col" className="table__num">
                    Submitted
                  </th>
                  <th scope="col" className="table__num">
                    Late
                  </th>
                  <th scope="col" className="table__num">
                    Outstanding
                  </th>
                  <th scope="col" className="table__actions">
                    <span className="u-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="table__primary-cell" data-label="Task">
                    <span className="table__primary">Task 4: Office administration plan</span>
                    <span className="table__secondary">Unit 5</span>
                  </td>
                  <td data-label="Due">
                    <span className="deadline">
                      <svg className="icon icon--sm" aria-hidden="true">
                        <use href="#i-clock" />
                      </svg>
                      Fri 2 Oct 2026, 17:00 · in 25 days
                    </span>
                  </td>
                  <td className="table__num" data-label="Submitted">
                    4
                  </td>
                  <td className="table__num" data-label="Late">
                    0
                  </td>
                  <td className="table__num" data-label="Outstanding">
                    92
                  </td>
                  <td className="table__actions">
                    <a className="btn btn--secondary btn--sm" href="#learners">
                      View learners
                      <span className="u-visually-hidden"> for Task 4</span>
                    </a>
                  </td>
                </tr>
                <tr className="is-selected">
                  <td className="table__primary-cell" data-label="Task">
                    <span className="table__primary">Task 3: Workplace records portfolio</span>
                    <span className="table__secondary">Unit 3 · shown below</span>
                  </td>
                  <td data-label="Due">
                    <span className="deadline deadline--closed">
                      <svg className="icon icon--sm" aria-hidden="true">
                        <use href="#i-clock" />
                      </svg>
                      Fri 4 Sep 2026, 17:00 · 3 days ago
                    </span>
                  </td>
                  <td className="table__num" data-label="Submitted">
                    67
                  </td>
                  <td className="table__num" data-label="Late">
                    6
                  </td>
                  <td className="table__num" data-label="Outstanding">
                    23 <span className="table__secondary">overdue</span>
                  </td>
                  <td className="table__actions">
                    <a className="btn btn--secondary btn--sm" href="#learners">
                      View learners
                      <span className="u-visually-hidden"> for Task 3</span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="table__primary-cell" data-label="Task">
                    <span className="table__primary">Task 2: Business letters</span>
                    <span className="table__secondary">Unit 4</span>
                  </td>
                  <td data-label="Due">
                    <span className="deadline deadline--closed">
                      <svg className="icon icon--sm" aria-hidden="true">
                        <use href="#i-clock" />
                      </svg>
                      Fri 14 Aug 2026, 17:00
                    </span>
                  </td>
                  <td className="table__num" data-label="Submitted">
                    93
                  </td>
                  <td className="table__num" data-label="Late">
                    3
                  </td>
                  <td className="table__num" data-label="Outstanding">
                    0
                  </td>
                  <td className="table__actions">
                    <Link className="btn btn--secondary btn--sm" href="/teach/submissions">
                      View learners
                      <span className="u-visually-hidden"> for Task 2</span>
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        {/* Learners for one task */}
        <section className="section" id="learners" aria-labelledby="learners-h" tabIndex={-1}>
          <div className="section__header">
            <h2 className="text-heading" id="learners-h">
              <span>Task 3: Workplace records portfolio</span>
            </h2>
            <span className="text-small text-muted">
              <span>
                Due Friday 4 September 2026 at 17:00 (SAST). Late work is still accepted and is marked as late.
              </span>
            </span>
          </div>
          <div className="table-toolbar">
            <label className="select pg-task">
              <span className="u-visually-hidden">Task</span>
              <select id="f-task" defaultValue="Task 3: Workplace records portfolio">
                <option>Task 4: Office administration plan</option>
                <option>Task 3: Workplace records portfolio</option>
                <option>Task 2: Business letters</option>
              </select>
            </label>{" "}
            <label className="input-icon table-toolbar__search">
              <span className="u-visually-hidden">Search by learner name or learner number</span>
              <svg className="icon" aria-hidden="true">
                <use href="#i-search" />
              </svg>
              <input className="input" type="search" id="f-learner" placeholder="Learner name or number" />
            </label>{" "}
            <span className="table-toolbar__end">
              <button
                type="button"
                className="btn btn--secondary table__select-mode"
                data-select-mode="#subs-wrap"
                aria-pressed="false"
              >
                Select
              </button>
              <button
                type="button"
                className="btn btn--secondary btn--sm u-hide-phone"
                data-density-toggle="#subs-wrap"
                aria-pressed="false"
              >
                Compact density
              </button>
            </span>
          </div>
          <div className="table-toolbar" role="group" aria-label="Filter by status">
            <button type="button" className="filter-chip" data-pg-filter="all" aria-pressed="true">
              All <span className="filter-chip__count">96</span>
            </button>{" "}
            <button type="button" className="filter-chip" data-pg-filter="outstanding" aria-pressed="false">
              Outstanding{" "}
              <span className="filter-chip__count">
                <span>23</span>
              </span>
            </button>{" "}
            <button type="button" className="filter-chip" data-pg-filter="submitted" aria-pressed="false">
              Submitted{" "}
              <span className="filter-chip__count">
                <span>67</span>
              </span>
            </button>{" "}
            <button type="button" className="filter-chip" data-pg-filter="late" aria-pressed="false">
              Late{" "}
              <span className="filter-chip__count">
                <span>6</span>
              </span>
            </button>
          </div>
          {/* Empty: nothing outstanding */}
          <div>
            <div className="table-wrap table-wrap--sticky" id="subs-wrap">
              <table className="table table--cards" id="subs-table">
                <caption className="u-visually-hidden">
                  Learners in 2026 Intake B and their submission status for Task 3, outstanding first
                </caption>
                <thead>
                  <tr>
                    <th scope="col" className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-all="#subs-table" />
                        <span className="u-visually-hidden">Select all rows shown</span>
                      </label>
                    </th>
                    <th scope="col" aria-sort="none">
                      <button type="button" className="table__sort">
                        Learner
                      </button>
                    </th>
                    <th scope="col" aria-sort="ascending">
                      <button type="button" className="table__sort">
                        Status
                      </button>
                    </th>
                    <th scope="col" aria-sort="none">
                      <button type="button" className="table__sort">
                        Submitted (SAST)
                      </button>
                    </th>
                    <th scope="col" className="table__num">
                      Version
                    </th>
                    <th scope="col">Last reminder (SAST)</th>
                    <th scope="col" className="table__actions">
                      <span className="u-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr data-status="outstanding" data-name="Sipho Zulu">
                    <td className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-row="" />
                        <span className="u-visually-hidden">Select Sipho Zulu</span>
                      </label>
                    </td>
                    <td className="table__primary-cell" data-label="Learner">
                      <span className="table__primary">Sipho Zulu</span>
                      <span className="table__secondary mono">KSI-2026-0398</span>
                    </td>
                    <td data-label="Status">
                      <span className="tag tag--caution">Outstanding (overdue)</span>
                    </td>
                    <td data-label="Submitted">Not submitted</td>
                    <td className="table__num" data-label="Version">
                      None
                    </td>
                    <td data-label="Last reminder" data-pg-reminder="">
                      3 Sep 2026, 08:00
                      <span className="table__secondary">Automatic, 1 day before due</span>
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" data-pg-history="">
                        History
                        <span className="u-visually-hidden"> for Sipho Zulu</span>
                      </button>
                    </td>
                  </tr>
                  <tr data-status="outstanding" data-name="Zinhle Ngcobo">
                    <td className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-row="" />
                        <span className="u-visually-hidden">Select Zinhle Ngcobo</span>
                      </label>
                    </td>
                    <td className="table__primary-cell" data-label="Learner">
                      <span className="table__primary">Zinhle Ngcobo</span>
                      <span className="table__secondary mono">KSI-2026-0402</span>
                    </td>
                    <td data-label="Status">
                      <span className="tag tag--caution">Outstanding (overdue)</span>
                    </td>
                    <td data-label="Submitted">Not submitted</td>
                    <td className="table__num" data-label="Version">
                      None
                    </td>
                    <td data-label="Last reminder" data-pg-reminder="">
                      3 Sep 2026, 08:00
                      <span className="table__secondary">Automatic, 1 day before due</span>
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" data-pg-history="">
                        History
                        <span className="u-visually-hidden"> for Zinhle Ngcobo</span>
                      </button>
                    </td>
                  </tr>
                  <tr data-status="outstanding" data-name="Ruan Pretorius">
                    <td className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-row="" />
                        <span className="u-visually-hidden">Select Ruan Pretorius</span>
                      </label>
                    </td>
                    <td className="table__primary-cell" data-label="Learner">
                      <span className="table__primary">Ruan Pretorius</span>
                      <span className="table__secondary mono">KSI-2026-0445</span>
                    </td>
                    <td data-label="Status">
                      <span className="tag tag--caution">Outstanding (overdue)</span>
                      <span className="table__secondary">Files uploaded, not yet submitted</span>
                    </td>
                    <td data-label="Submitted">Not submitted</td>
                    <td className="table__num" data-label="Version">
                      None
                    </td>
                    <td data-label="Last reminder" data-pg-reminder="">
                      3 Sep 2026, 08:00
                      <span className="table__secondary">Automatic, 1 day before due</span>
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" data-pg-history="">
                        History
                        <span className="u-visually-hidden"> for Ruan Pretorius</span>
                      </button>
                    </td>
                  </tr>
                  <tr data-status="outstanding" data-name="Palesa Mofokeng">
                    <td className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-row="" />
                        <span className="u-visually-hidden">Select Palesa Mofokeng</span>
                      </label>
                    </td>
                    <td className="table__primary-cell" data-label="Learner">
                      <span className="table__primary">Palesa Mofokeng</span>
                      <span className="table__secondary mono">KSI-2026-0409</span>
                    </td>
                    <td data-label="Status">
                      <span className="tag tag--caution">Outstanding (overdue)</span>
                    </td>
                    <td data-label="Submitted">Not submitted</td>
                    <td className="table__num" data-label="Version">
                      None
                    </td>
                    <td data-label="Last reminder" data-pg-reminder="">
                      3 Sep 2026, 08:00
                      <span className="table__secondary">Automatic, 1 day before due</span>
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" data-pg-history="">
                        History
                        <span className="u-visually-hidden"> for Palesa Mofokeng</span>
                      </button>
                    </td>
                  </tr>
                  <tr data-status="outstanding" data-name="Imraan Davids">
                    <td className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-row="" />
                        <span className="u-visually-hidden">Select Imraan Davids</span>
                      </label>
                    </td>
                    <td className="table__primary-cell" data-label="Learner">
                      <span className="table__primary">Imraan Davids</span>
                      <span className="table__secondary mono">KSI-2026-0437</span>
                    </td>
                    <td data-label="Status">
                      <span className="tag tag--caution">Outstanding (overdue)</span>
                    </td>
                    <td data-label="Submitted">Not submitted</td>
                    <td className="table__num" data-label="Version">
                      None
                    </td>
                    <td data-label="Last reminder" data-pg-reminder="">
                      3 Sep 2026, 08:00
                      <span className="table__secondary">Automatic, 1 day before due</span>
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" data-pg-history="">
                        History
                        <span className="u-visually-hidden"> for Imraan Davids</span>
                      </button>
                    </td>
                  </tr>
                  <tr data-status="late" data-name="Lerato Mokoena">
                    <td className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-row="" />
                        <span className="u-visually-hidden">Select Lerato Mokoena</span>
                      </label>
                    </td>
                    <td className="table__primary-cell" data-label="Learner">
                      <span className="table__primary">Lerato Mokoena</span>
                      <span className="table__secondary mono">KSI-2026-0417</span>
                    </td>
                    <td data-label="Status">
                      <span className="tag tag--caution">Late</span>
                      <span className="table__secondary">By 42 minutes</span>
                    </td>
                    <td data-label="Submitted">
                      <time className="datetime" dateTime="2026-09-04T17:42:00+02:00">
                        4 Sep 2026, <span className="datetime__time">17:42</span>
                      </time>
                    </td>
                    <td className="table__num" data-label="Version">
                      2
                    </td>
                    <td data-label="Last reminder" data-pg-reminder="">
                      3 Sep 2026, 08:00
                      <span className="table__secondary">Automatic, 1 day before due</span>
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" data-pg-history="">
                        History
                        <span className="u-visually-hidden"> for Lerato Mokoena</span>
                      </button>
                    </td>
                  </tr>
                  <tr data-status="submitted" data-name="Ayesha Patel">
                    <td className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-row="" />
                        <span className="u-visually-hidden">Select Ayesha Patel</span>
                      </label>
                    </td>
                    <td className="table__primary-cell" data-label="Learner">
                      <span className="table__primary">Ayesha Patel</span>
                      <span className="table__secondary mono">KSI-2026-0422</span>
                    </td>
                    <td data-label="Status">
                      <span className="tag tag--positive">Submitted</span>
                    </td>
                    <td data-label="Submitted">
                      <time className="datetime" dateTime="2026-09-04T09:15:00+02:00">
                        4 Sep 2026, <span className="datetime__time">09:15</span>
                      </time>
                    </td>
                    <td className="table__num" data-label="Version">
                      1
                    </td>
                    <td data-label="Last reminder" data-pg-reminder="">
                      3 Sep 2026, 08:00
                      <span className="table__secondary">Automatic, 1 day before due</span>
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" data-pg-history="">
                        History
                        <span className="u-visually-hidden"> for Ayesha Patel</span>
                      </button>
                    </td>
                  </tr>
                  <tr data-status="submitted" data-name="Johan Botha">
                    <td className="table__check">
                      <label className="check check--bare">
                        <input className="check__input" type="checkbox" data-select-row="" />
                        <span className="u-visually-hidden">Select Johan Botha</span>
                      </label>
                    </td>
                    <td className="table__primary-cell" data-label="Learner">
                      <span className="table__primary">Johan Botha</span>
                      <span className="table__secondary mono">KSI-2026-0431</span>
                    </td>
                    <td data-label="Status">
                      <span className="tag tag--positive">Submitted</span>
                    </td>
                    <td data-label="Submitted">
                      <time className="datetime" dateTime="2026-09-03T14:05:00+02:00">
                        3 Sep 2026, <span className="datetime__time">14:05</span>
                      </time>
                    </td>
                    <td className="table__num" data-label="Version">
                      1
                    </td>
                    <td data-label="Last reminder" data-pg-reminder="">
                      None sent
                    </td>
                    <td className="table__actions">
                      <button type="button" className="btn btn--secondary btn--sm" data-pg-history="">
                        History
                        <span className="u-visually-hidden"> for Johan Botha</span>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="bulk-bar" data-bulk-bar="" role="region" aria-label="Bulk actions" hidden>
              <span className="bulk-bar__count">
                <span data-selected-count="">0</span> selected
              </span>{" "}
              <button type="button" className="btn btn--secondary" id="btn-remind" data-modal-open="m-reminder">
                <svg className="icon icon--sm" aria-hidden="true">
                  <use href="#i-megaphone" />
                </svg>
                Send reminder
              </button>{" "}
              <button
                type="button"
                className="btn btn--secondary"
                data-toast="Export ready: selected learners"
                data-toast-meta="CSV · 7 Sep 2026, 08:45"
              >
                Export selected
              </button>
            </div>
            <nav className="pagination u-mt-4" aria-label="Learner pages">
              <span id="pg-showing">Showing 1 to 8 of 96</span>
              <ul className="pagination__list">
                <li>
                  <a className="pagination__item" role="link" aria-disabled="true" aria-label="Previous page">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-caret-left" />
                    </svg>
                  </a>
                </li>
                <li>
                  <a className="pagination__item" href="#learners" aria-current="page" aria-label="Page 1, current">
                    1
                  </a>
                </li>
                <li>
                  <a className="pagination__item" href="#learners" aria-label="Page 2">
                    2
                  </a>
                </li>
                <li>
                  <a className="pagination__item" href="#learners" aria-label="Page 3">
                    3
                  </a>
                </li>
                <li>
                  <a className="pagination__item" href="#learners" aria-label="Next page">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-caret-right" />
                    </svg>
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </section>
      </div>
    </>
  );
}
