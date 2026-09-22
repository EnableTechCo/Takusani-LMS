import Link from "next/link";

export const metadata = { title: "Appeals" };

// Ported from docs/design/ui/prototype/coordinate-appeals.html (default state). Static shell: no data or behaviour yet.
export default function CoordinateAppealsPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <p className="page-header__workspace">Coordinating</p>
          <h1 className="page-header__title">Appeals</h1>
          <p className="page-header__lead">
            Every appeal needs two things from you: a decision on whether it can be accepted, and for a remark, a
            reviewer who took no assessment decision on the work. Learners were promised a reply within 5 working days.
          </p>
          <div className="page-header__meta">
            <span className="tag tag--info">3 need your action</span> <span>All my cohorts</span>
            <span className="text-meta">As at Fri 25 Sep 2026, 09:30 SAST</span>
          </div>
        </header>
        <div className="grid grid--4 u-mb-6">
          <div className="stat">
            <span className="stat__label">Need your action</span>
            <span className="stat__value">
              <span>3</span>
            </span>
            <span className="stat__meta">
              <span>1 new · 1 being checked · 1 needs a reviewer</span>
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">Oldest without a reviewer</span>
            <span className="stat__value">
              <span>
                2 <span className="stat__unit">days</span>
              </span>
            </span>
            <span className="stat__meta">
              <span>APL-2026-0029, lodged Wed 23 Sep 2026</span>
            </span>
          </div>
          <div className="stat">
            <span className="stat__label">With a reviewer</span>
            <span className="stat__value">2</span>
            <span className="stat__meta">1 is past its reply day</span>
          </div>
          <div className="stat">
            <span className="stat__label">Closed in September</span>
            <span className="stat__value">4</span>
            <span className="stat__meta">1 upheld · 1 higher · 1 lower · 1 inadmissible</span>
          </div>
        </div>
        <div className="table-toolbar" id="appeal-filters">
          <label className="input-icon table-toolbar__search">
            <span className="u-visually-hidden">Search appeals by reference or learner</span>
            <svg className="icon" aria-hidden="true">
              <use href="#i-search" />
            </svg>
            <input className="input" type="search" placeholder="Reference or learner" />
          </label>{" "}
          <button type="button" className="filter-chip" aria-pressed="true" data-filter="action">
            Needs my action{" "}
            <span className="filter-chip__count">
              <span>3</span>
            </span>
          </button>{" "}
          <button type="button" className="filter-chip" aria-pressed="false" data-filter="review">
            With a reviewer <span className="filter-chip__count">2</span>
          </button>{" "}
          <button type="button" className="filter-chip" aria-pressed="false" data-filter="closed">
            Closed <span className="filter-chip__count">4</span>
          </button>{" "}
          <button type="button" className="filter-chip" aria-pressed="false" data-filter="all">
            All{" "}
            <span className="filter-chip__count">
              <span>9</span>
            </span>
          </button>{" "}
          <span className="table-toolbar__end">
            <button
              type="button"
              className="btn btn--secondary btn--sm u-hide-phone"
              data-toast="Export started"
              data-toast-meta="appeals-2026-09-25.csv"
            >
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-download" />
              </svg>
              Export
            </button>
          </span>
        </div>
        <p className="text-small text-muted u-mb-4" role="status" id="appeal-count">
          Showing appeals that need your action, oldest first.
        </p>
        <div className="card" id="appeal-empty" hidden>
          <div className="empty">
            <span className="empty__icon">
              <svg className="icon icon--lg" aria-hidden="true">
                <use href="#i-scales" />
              </svg>
            </span>
            <p className="empty__title">Nothing needs your action</p>
            <p className="empty__body">
              New appeals appear here as soon as a learner lodges one. The window for Task 3 closes at the end of
              Tuesday 29 September 2026.
            </p>
            <div className="empty__actions">
              <button type="button" className="btn btn--secondary" data-filter-go="all">
                See all appeals
              </button>
            </div>
          </div>
        </div>
        <div className="table-wrap" id="appeal-wrap">
          <table className="table table--cards" id="appeal-table">
            <caption className="u-visually-hidden">Appeals, oldest first within each state. Times in SAST.</caption>
            <thead>
              <tr>
                <th scope="col">Learner</th>
                <th scope="col">Appeal</th>
                <th scope="col">Item</th>
                <th scope="col">State</th>
                <th scope="col" aria-sort="ascending">
                  <button type="button" className="table__sort">
                    Lodged (SAST)
                  </button>
                </th>
                <th scope="col">Reply to the learner by</th>
                <th scope="col">Owner</th>
                <th scope="col" className="table__actions">
                  <span className="u-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr data-group="action">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Thabo Molefe</span>
                  <span className="table__secondary">2026 Intake C</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0029</span>
                  <span className="table__secondary">Remark</span>
                </td>
                <td data-label="Item">Task 3: Workplace records portfolio</td>
                <td data-label="State">
                  <span className="tag tag--info">Accepted. Needs a reviewer</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-23T09:12:00+02:00">
                    23 Sep 2026, <span className="datetime__time">09:12</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-clock" />
                    </svg>
                    Wed 30 Sep 2026 · 4 working days left
                  </span>
                </td>
                <td data-label="Owner">Zanele Dlamini (you)</td>
                <td className="table__actions">
                  <Link className="btn btn--secondary btn--sm" href="/coordinate/appeals/apl-2026-0031">
                    Choose reviewer
                    <span className="u-visually-hidden"> for APL-2026-0029, Thabo Molefe</span>
                  </Link>
                </td>
              </tr>
              <tr data-group="action">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Sipho Zulu</span>
                  <span className="table__secondary">2026 Intake B</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0030</span>
                  <span className="table__secondary">View marked script</span>
                </td>
                <td data-label="Item">Task 3: Workplace records portfolio</td>
                <td data-label="State">
                  <span className="tag tag--info tag--shape-half">Being checked</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-23T16:40:00+02:00">
                    23 Sep 2026, <span className="datetime__time">16:40</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-clock" />
                    </svg>
                    Wed 30 Sep 2026 · 4 working days left
                  </span>
                </td>
                <td data-label="Owner">Zanele Dlamini (you)</td>
                <td className="table__actions">
                  <a
                    className="btn btn--secondary btn--sm"
                    href="#main"
                    data-toast="This screen is not part of the prototype"
                  >
                    Open
                    <span className="u-visually-hidden"> APL-2026-0030, Sipho Zulu</span>
                  </a>
                </td>
              </tr>
              <tr data-group="action">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Lerato Mokoena</span>
                  <span className="table__secondary">2026 Intake B</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0031</span>
                  <span className="table__secondary">Remark</span>
                </td>
                <td data-label="Item">Task 3: Workplace records portfolio</td>
                <td data-label="State">
                  <span className="tag tag--info">New. Needs admissibility check</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-24T08:14:00+02:00">
                    24 Sep 2026, <span className="datetime__time">08:14</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-clock" />
                    </svg>
                    Thu 1 Oct 2026 · 5 working days left
                  </span>
                </td>
                <td data-label="Owner">Zanele Dlamini (you)</td>
                <td className="table__actions">
                  <Link className="btn btn--secondary btn--sm" href="/coordinate/appeals/apl-2026-0031">
                    Check
                    <span className="u-visually-hidden"> APL-2026-0031, Lerato Mokoena</span>
                  </Link>
                </td>
              </tr>
              <tr data-group="review">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Naledi Khoza</span>
                  <span className="table__secondary">2026 Intake B</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0024</span>
                  <span className="table__secondary">Remark</span>
                </td>
                <td data-label="Item">Unit 2 summative exam</td>
                <td data-label="State">
                  <span className="tag tag--info tag--shape-half">Under review by Nomvula Mahlangu</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-16T11:05:00+02:00">
                    16 Sep 2026, <span className="datetime__time">11:05</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline deadline--overdue">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-clock" />
                    </svg>
                    Was Wed 23 Sep 2026 · 1 working day over
                  </span>
                </td>
                <td data-label="Owner">Nomvula Mahlangu</td>
                <td className="table__actions">
                  <a
                    className="btn btn--secondary btn--sm"
                    href="#main"
                    data-toast="This screen is not part of the prototype"
                  >
                    Open
                    <span className="u-visually-hidden"> APL-2026-0024, Naledi Khoza</span>
                  </a>
                </td>
              </tr>
              <tr data-group="review">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Johan Botha</span>
                  <span className="table__secondary">2026 Intake B</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0027</span>
                  <span className="table__secondary">Remark</span>
                </td>
                <td data-label="Item">Task 3: Workplace records portfolio</td>
                <td data-label="State">
                  <span className="tag tag--info">Allocated to Anil Naidoo</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-22T19:05:00+02:00">
                    22 Sep 2026, <span className="datetime__time">19:05</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline deadline--soon">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-clock" />
                    </svg>
                    Tue 29 Sep 2026 · 3 working days left
                  </span>
                </td>
                <td data-label="Owner">Anil Naidoo</td>
                <td className="table__actions">
                  <a
                    className="btn btn--secondary btn--sm"
                    href="#main"
                    data-toast="This screen is not part of the prototype"
                  >
                    Open
                    <span className="u-visually-hidden"> APL-2026-0027, Johan Botha</span>
                  </a>
                </td>
              </tr>
              <tr data-group="closed">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Lindiwe Mabaso</span>
                  <span className="table__secondary">2026 Intake C</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0019</span>
                  <span className="table__secondary">Remark</span>
                </td>
                <td data-label="Item">Task 2: Meeting minutes</td>
                <td data-label="State">
                  <span className="tag tag--shape-check">Concluded: upheld</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-03T10:20:00+02:00">
                    3 Sep 2026, <span className="datetime__time">10:20</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline deadline--closed">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-lock" />
                    </svg>
                    Replied Wed 9 Sep 2026
                  </span>
                </td>
                <td data-label="Owner">Thandiwe Nkosi</td>
                <td className="table__actions">
                  <a
                    className="btn btn--secondary btn--sm"
                    href="#main"
                    data-toast="This screen is not part of the prototype"
                  >
                    Open
                    <span className="u-visually-hidden"> APL-2026-0019, Lindiwe Mabaso</span>
                  </a>
                </td>
              </tr>
              <tr data-group="closed">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Zinhle Ngcobo</span>
                  <span className="table__secondary">2026 Intake C</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0021</span>
                  <span className="table__secondary">Remark</span>
                </td>
                <td data-label="Item">Task 2: Meeting minutes</td>
                <td data-label="State">
                  <span className="tag tag--positive">Concluded: amended upward</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-04T14:02:00+02:00">
                    4 Sep 2026, <span className="datetime__time">14:02</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline deadline--closed">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-lock" />
                    </svg>
                    Replied Thu 10 Sep 2026
                  </span>
                </td>
                <td data-label="Owner">Thandiwe Nkosi</td>
                <td className="table__actions">
                  <a
                    className="btn btn--secondary btn--sm"
                    href="#main"
                    data-toast="This screen is not part of the prototype"
                  >
                    Open
                    <span className="u-visually-hidden"> APL-2026-0021, Zinhle Ngcobo</span>
                  </a>
                </td>
              </tr>
              <tr data-group="closed">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Kagiso Tau</span>
                  <span className="table__secondary">2026 Intake C</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0022</span>
                  <span className="table__secondary">Remark</span>
                </td>
                <td data-label="Item">Task 2: Meeting minutes</td>
                <td data-label="State">
                  <span className="tag tag--caution">Concluded: amended downward</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-07T08:45:00+02:00">
                    7 Sep 2026, <span className="datetime__time">08:45</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline deadline--closed">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-lock" />
                    </svg>
                    Replied Mon 14 Sep 2026
                  </span>
                </td>
                <td data-label="Owner">Thandiwe Nkosi</td>
                <td className="table__actions">
                  <a
                    className="btn btn--secondary btn--sm"
                    href="#main"
                    data-toast="This screen is not part of the prototype"
                  >
                    Open
                    <span className="u-visually-hidden"> APL-2026-0022, Kagiso Tau</span>
                  </a>
                </td>
              </tr>
              <tr data-group="closed">
                <td className="table__primary-cell" data-label="Learner">
                  <span className="table__primary">Palesa Mthembu</span>
                  <span className="table__secondary">2026 Intake C</span>
                </td>
                <td data-label="Appeal">
                  <span className="mono">APL-2026-0023</span>
                  <span className="table__secondary">Remark</span>
                </td>
                <td data-label="Item">Task 2: Meeting minutes</td>
                <td data-label="State">
                  <span className="tag tag--shape-square">Inadmissible</span>
                  <span className="table__secondary">Lodged after the window closed</span>
                </td>
                <td data-label="Lodged">
                  <time className="datetime" dateTime="2026-09-11T07:58:00+02:00">
                    11 Sep 2026, <span className="datetime__time">07:58</span>
                  </time>
                </td>
                <td data-label="Reply by">
                  <span className="deadline deadline--closed">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-lock" />
                    </svg>
                    Replied Fri 11 Sep 2026
                  </span>
                </td>
                <td data-label="Owner">Zanele Dlamini (you)</td>
                <td className="table__actions">
                  <a
                    className="btn btn--secondary btn--sm"
                    href="#main"
                    data-toast="This screen is not part of the prototype"
                  >
                    Open
                    <span className="u-visually-hidden"> APL-2026-0023, Palesa Mthembu</span>
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <nav className="pagination u-mt-4" aria-label="Appeal pages">
          <span id="appeal-range">Showing 3 of 9</span>
          <ul className="pagination__list">
            <li>
              <a className="pagination__item" role="link" aria-disabled="true" aria-label="Previous page">
                <svg className="icon icon--sm" aria-hidden="true">
                  <use href="#i-caret-left" />
                </svg>
              </a>
            </li>
            <li>
              <a className="pagination__item" href="#main" aria-current="page" aria-label="Page 1, current">
                1
              </a>
            </li>
            <li>
              <a className="pagination__item" role="link" aria-disabled="true" aria-label="Next page">
                <svg className="icon icon--sm" aria-hidden="true">
                  <use href="#i-caret-right" />
                </svg>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </>
  );
}
