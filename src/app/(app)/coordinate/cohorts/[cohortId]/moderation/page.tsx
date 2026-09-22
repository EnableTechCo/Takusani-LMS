import type { CSSProperties } from "react";
import Link from "next/link";
import "./page.css";

export const metadata = { title: "Moderation planning" };

// Ported from docs/design/ui/prototype/coordinate-moderation.html (default state). Static shell: no data or behaviour yet.
export default function CoordinateModerationPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <a href="#main" data-toast="This screen is not part of the prototype">
                  Cohorts
                </a>
              </li>
              <li>
                <Link href="/coordinate/cohorts/2026-intake-b/setup">2026 Intake B</Link>
              </li>
              <li aria-current="page">Moderation</li>
            </ol>
          </nav>
          <p className="page-header__workspace">Coordinating</p>
          <h1 className="page-header__title">Moderation planning</h1>
          <p className="page-header__lead">
            Every result in this cohort is held from the moment the assessor decides. A result is released only when a
            moderation cycle that covers it is signed off.
          </p>
          <div className="page-header__meta">
            <span className="tag tag--caution">Results waiting, no cycle planned</span>{" "}
            <span>
              2026 Intake B <span className="tag tag--plain">Moderated</span>
            </span>{" "}
            <span className="text-meta">
              As at <span>Mon 7 Sep 2026, 08:30</span> SAST
            </span>
          </div>
        </header>
        <nav className="cohort-nav" aria-label="Pages for this cohort">
          <Link href="/coordinate/cohorts/2026-intake-b/setup">Setup</Link>{" "}
          <a href="#main" data-toast="This screen is not part of the prototype">
            People
          </a>{" "}
          <a href="#main" data-toast="This screen is not part of the prototype">
            Readiness
          </a>{" "}
          <strong aria-current="page">Moderation</strong>
        </nav>
        <div className="banner banner--caution" role="alert">
          <svg className="icon banner__icon" aria-hidden="true">
            <use href="#i-info" />
          </svg>
          <p className="banner__title">38 results are waiting and no cycle is planned to release them</p>
          <p className="banner__body">
            The number grows every time an assessor decides. The oldest was decided 4 days ago, on Thu 3 Sep 2026.
            Nothing is released until a cycle covering Task 3 is planned, sampled and signed off. The maximum hold is 21
            days, so the oldest result passes it on Thu 24 Sep 2026.
          </p>
          <div className="banner__actions">
            <a href="#plan-h">Plan a cycle for these results</a>
          </div>
        </div>
        {/* ============ Pending pool ============ */}
        <section aria-labelledby="pool-h">
          <div className="section__header">
            <h2 className="text-heading" id="pool-h">
              Decided and waiting for a cycle
            </h2>
            <span className="text-small text-muted">Held results that no cycle has locked yet</span>
          </div>
          <div className="grid grid--3">
            <div className="stat">
              <span className="stat__label">Waiting for a cycle</span>{" "}
              <span className="stat__value">
                <span>38</span> <span className="stat__unit">results</span>
              </span>{" "}
              <span className="stat__meta">
                <span>Thandiwe Nkosi 36 · Bongani Sithole 2. No cycle will claim them.</span>
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Oldest waiting result</span>{" "}
              <span className="stat__value">
                <span>4</span> <span className="stat__unit">days of the 21-day maximum hold</span>
              </span>{" "}
              <span className="stat__meta">
                <span>Decided Thu 3 Sep 2026</span>
              </span>
              <div className="progress" role="img" aria-label="4 of 21 days">
                <div className="progress__bar" style={{ "--value": "19%" } as CSSProperties} />
              </div>
            </div>
            <div className="stat">
              <span className="stat__label">Held in a frozen cycle</span>{" "}
              <span className="stat__value">
                <span>0</span> <span className="stat__unit">results</span>
              </span>{" "}
              <span className="stat__meta">
                <span>Nothing is frozen yet.</span>
              </span>
            </div>
          </div>
          <div className="table-wrap u-mt-4">
            <table className="table table--cards">
              <caption className="u-visually-hidden">
                Waiting results by assessable item, with the assessor split and the age of the oldest
              </caption>
              <thead>
                <tr>
                  <th scope="col">Assessable item</th>
                  <th scope="col">By assessor</th>
                  <th scope="col" className="table__num">
                    Waiting
                  </th>
                  <th scope="col">Oldest decided</th>
                  <th scope="col">Age against the 21-day maximum hold</th>
                  <th scope="col">What happens to them</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="table__primary-cell" data-label="Item">
                    <span className="table__primary">Task 3: Workplace records portfolio</span>
                    <span className="table__secondary">Unit 3 · 8 credits</span>
                  </td>
                  <td data-label="By assessor">
                    <span>
                      <span>Thandiwe Nkosi 36 · Bongani Sithole 2</span>
                    </span>
                  </td>
                  <td className="table__num" data-label="Waiting">
                    <span>
                      <span>38</span>
                    </span>
                  </td>
                  <td data-label="Oldest decided">
                    <span>
                      <span>Thu 3 Sep 2026</span>
                    </span>
                  </td>
                  <td data-label="Age">
                    <span className="mono">
                      <span>4 of 21 days</span>
                    </span>
                  </td>
                  <td data-label="What happens">
                    <span>
                      <span className="tag tag--caution">Not in any cycle</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-small text-muted u-mt-2">
            Learners see &quot;Being assessed&quot; for all of these. The maximum hold is set by the System
            Administrator under Configuration.
          </p>
        </section>
        {/* ============ Cycles ============ */}
        <section className="section" aria-labelledby="cycles-h">
          <div className="section__header">
            <h2 className="text-heading" id="cycles-h">
              Cycles
            </h2>
          </div>
          <div className="table-wrap">
            <table className="table table--cards">
              <caption className="u-visually-hidden">Moderation cycles for 2026 Intake B, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Cycle</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Start (SAST)</th>
                  <th scope="col">State</th>
                  <th scope="col">Results</th>
                  <th scope="col" className="table__actions">
                    <span className="u-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="table__primary-cell" data-label="Cycle">
                    <span className="table__primary">Term 2 tasks</span>
                    <span className="table__secondary">Planned by Zanele Dlamini, Mon 8 Jun 2026</span>
                  </td>
                  <td data-label="Scope">Task 1, Task 2</td>
                  <td data-label="Start">When chosen: Mon 15 Jun 2026, 10:12</td>
                  <td data-label="State">
                    <span className="tag tag--positive">Signed off. 188 results released</span>
                  </td>
                  <td data-label="Results">Signed off by Anil Naidoo, Fri 26 Jun 2026, 15:30</td>
                  <td className="table__actions">
                    <a
                      className="btn btn--secondary btn--sm"
                      href="#main"
                      data-toast="This screen is not part of the prototype"
                    >
                      View
                      <span className="u-visually-hidden"> Term 2 tasks</span>
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="table__primary-cell" data-label="Cycle">
                    <span className="table__primary">Term 2 tasks (first plan)</span>
                    <span className="table__secondary">Planned by Zanele Dlamini, Tue 2 Jun 2026</span>
                  </td>
                  <td data-label="Scope">Task 1 only</td>
                  <td data-label="Start">Not started</td>
                  <td data-label="State">
                    <span className="tag tag--shape-square">Cancelled before freeze</span>
                  </td>
                  <td data-label="Results">
                    Cancelled by Zanele Dlamini, Mon 8 Jun 2026. The results stayed waiting and joined &quot;Term 2
                    tasks&quot;.
                  </td>
                  <td className="table__actions">
                    <a
                      className="btn btn--secondary btn--sm"
                      href="#main"
                      data-toast="This screen is not part of the prototype"
                    >
                      View
                      <span className="u-visually-hidden"> the cancelled cycle</span>
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        {/* ============ Selected cycle: planned / sampled ============ */}
        {/* ============ Plan a cycle ============ */}
        <section className="section" aria-labelledby="plan-h">
          <div className="section__header">
            <h2 className="text-heading" id="plan-h" tabIndex={-1}>
              Plan a cycle
            </h2>
          </div>
          <form className="form plan-form" noValidate>
            <div className="field">
              <label className="field__label" htmlFor="p-name">
                Cycle name <span className="field__required">(required)</span>
              </label>
              <p className="field__help" id="p-name-help">
                Moderators and assessors see this name.
              </p>
              <input
                className="input"
                id="p-name"
                type="text"
                defaultValue="Term 3 tasks"
                aria-describedby="p-name-help"
              />
            </div>
            <fieldset className="fieldset">
              <legend className="fieldset__legend">Choose the scope by</legend>
              <label className="check">
                <input className="check__input" type="radio" name="scope-by" defaultChecked />
                <span className="check__label">Assessable items</span>
              </label>{" "}
              <label className="check">
                <input className="check__input" type="radio" name="scope-by" />
                <span className="check__label">Whole units</span>
                <span className="check__help">Every assessable item in the unit, including ones added later.</span>
              </label>
            </fieldset>
            <fieldset className="fieldset" aria-describedby="p-scope-help">
              <legend className="fieldset__legend">
                Items in this cycle <span className="field__required">(required)</span>
              </legend>
              <p className="field__help" id="p-scope-help">
                When the cycle freezes it locks every waiting result for these items. An item can be in one open cycle
                at a time.
              </p>
              <div className="scope-list">
                <label className="check">
                  <input
                    className="check__input"
                    type="checkbox"
                    id="p-t3"
                    defaultChecked
                    aria-describedby="p-t3-help"
                  />
                  <span className="check__label">Task 3: Workplace records portfolio</span>
                  <span className="check__help" id="p-t3-help">
                    <span>Unit 3 · 38 waiting now · 58 still to be marked</span>
                  </span>
                </label>
                <label className="check">
                  <input className="check__input" type="checkbox" id="p-t4" />
                  <span className="check__label">Task 4: Business communication report</span>
                  <span className="check__help">
                    <span>Unit 4 · 0 waiting · due Fri 11 Sep 2026</span>
                  </span>
                </label>{" "}
                <label className="check">
                  <input className="check__input" type="checkbox" id="p-u2" />
                  <span className="check__label">Unit 2 summative exam</span>
                  <span className="check__help">
                    <span>Unit 2 · 0 waiting</span>
                  </span>
                </label>{" "}
                <label className="check">
                  <input className="check__input" type="checkbox" disabled aria-describedby="p-t2-help" />
                  <span className="check__label">Task 2: Meeting minutes</span>
                  <span className="check__help" id="p-t2-help">
                    Nothing to moderate: all 96 results were released in &quot;Term 2 tasks&quot; on Fri 26 Jun 2026.
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="form__row form__row--2">
              <div className="field">
                <label className="field__label" htmlFor="p-from">
                  Only results decided from <span className="field__optional">(optional)</span>
                </label>
                <input className="input" id="p-from" type="date" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="p-to">
                  to the end of <span className="field__optional">(optional)</span>
                </label>
                <input className="input" id="p-to" type="date" />
              </div>
            </div>
            <fieldset className="fieldset">
              <legend className="fieldset__legend">When should the cycle freeze and draw its sample?</legend>
              <div className="choice-group choice-group--2">
                <label className="choice">
                  <input className="choice__input" type="radio" name="start" id="p-manual" />
                  <span className="choice__title">When I choose</span>
                  <span className="choice__desc">Results keep waiting until you select Freeze and sample.</span>
                </label>{" "}
                <label className="choice">
                  <input className="choice__input" type="radio" name="start" id="p-auto" defaultChecked />
                  <span className="choice__title">Automatically on a date</span>
                  <span className="choice__desc">
                    The LMS freezes and samples at that time, whether or not anyone is signed in.
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="form__row form__row--2">
              <div className="field">
                <label className="field__label" htmlFor="p-date">
                  Start date
                </label>
                <input className="input" id="p-date" type="date" defaultValue="2026-09-14" />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="p-time">
                  Start time (SAST)
                </label>
                <input className="input" id="p-time" type="time" defaultValue="09:00" />
              </div>
            </div>
            <div className="form__row form__row--2">
              <div className="field">
                <label className="field__label" htmlFor="p-rule">
                  Sampling rule in force
                </label>
                <p className="field__help" id="p-rule-help">
                  Set by the System Administrator. The cycle keeps the version in force when it freezes.
                </p>
                <input
                  className="input input--mono"
                  id="p-rule"
                  defaultValue="rule-v4 · 15% · all NYC · all first-time assessors"
                  readOnly
                  aria-describedby="p-rule-help"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="p-mods">
                  Moderators available
                </label>
                <p className="field__help" id="p-mods-help">
                  Anyone who assessed an item is never given that item.
                </p>
                <input
                  className="input"
                  id="p-mods"
                  defaultValue="Anil Naidoo: can take every item in scope"
                  readOnly
                  aria-describedby="p-mods-help"
                />
              </div>
            </div>
            <div className="form__actions">
              <button type="button" className="btn btn--primary" id="p-submit">
                Plan cycle
              </button>
              <button type="reset" className="btn btn--ghost">
                Clear
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
