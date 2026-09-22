import type { CSSProperties } from "react";
import Link from "next/link";
import "./page.css";

export const metadata = { title: "Sign off: Unit 3 portfolios · Moderating" };

// Ported from docs/design/ui/prototype/moderate-signoff.html (default state). Static shell: no data or behaviour yet.
export default function ModerateSignoffPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <a href="#main">Cycles</a>
              </li>
              <li>
                <a href="#main">Unit 3 portfolios</a>
              </li>
              <li aria-current="page">Sign-off</li>
            </ol>
          </nav>
          <p className="page-header__workspace">Moderating</p>
          <h1 className="page-header__title">Sign off: Unit 3 portfolios</h1>
          <p className="page-header__lead">
            Sign-off releases the results that were frozen into this cycle. It is the only way a result in a moderated
            cohort reaches its learner.
          </p>
          <div className="page-header__meta">
            <span className="tag tag--caution">Waiting for re-marks (2 outstanding)</span>{" "}
            <span>
              2026 Intake C <span className="tag tag--plain">Moderated</span>
            </span>{" "}
            <span className="text-meta">Cycle MC-2026-C-02</span>
          </div>
        </header>
        <div className="banner banner--caution" role="alert">
          <svg className="icon banner__icon" aria-hidden="true">
            <use href="#i-info" />
          </svg>
          <p className="banner__title">You cannot sign off yet: 2 returned items are still open</p>
          <p className="banner__body">
            Both are listed below with who must act next and by when. Nothing is released, and no learner is told
            anything, until they are concluded.
          </p>
          <div className="banner__actions">
            <a href="#outstanding">See the 2 open items</a>
          </div>
        </div>
        {/* Cycle progress */}
        <section className="section" aria-labelledby="prog-h">
          <div className="section__header">
            <h2 className="text-heading" id="prog-h">
              Cycle progress
            </h2>
          </div>
          <ol className="stepper stepper--horizontal" aria-label="Unit 3 portfolios: moderation cycle progress">
            <li className="stepper__step is-complete">
              <span className="stepper__label">
                Planned
                <span className="u-visually-hidden"> (done)</span>
              </span>
              <span className="stepper__meta">Zanele Dlamini, 14 Sep</span>
            </li>
            <li className="stepper__step is-complete">
              <span className="stepper__label">
                Sampled
                <span className="u-visually-hidden"> (done)</span>
              </span>
              <span className="stepper__meta">18 Sep · 18 of 64 · rule-v4</span>
            </li>
            <li className="stepper__step is-complete">
              <span className="stepper__label">
                In review
                <span className="u-visually-hidden"> (done)</span>
              </span>
              <span className="stepper__meta">16 agreed, 2 returned</span>
            </li>
            <li className="stepper__step is-blocked" aria-current="step">
              <span className="stepper__label">
                Waiting for re-marks
                <span className="u-visually-hidden"> (blocked)</span>
              </span>
              <span className="stepper__body">2 returned items are open.</span>
            </li>
            <li className="stepper__step">
              <span className="stepper__label">
                Signed off
                <span className="u-visually-hidden"> (not yet)</span>
              </span>
              <span className="stepper__body">Releases 64 results.</span>
            </li>
          </ol>
          <div className="grid grid--4 u-mt-6">
            <div className="stat">
              <span className="stat__label">Frozen population</span>
              <span className="stat__value">
                64 <span className="stat__unit">results</span>
              </span>
              <span className="stat__meta">Exactly these are released at sign-off</span>
            </div>
            <div className="stat">
              <span className="stat__label">Sample</span>
              <span className="stat__value">
                18 <span className="stat__unit">items</span>
              </span>
              <span className="stat__meta">10 random, 8 mandatory · all allocated to you</span>
            </div>
            <div className="stat">
              <span className="stat__label">Items concluded</span>
              <span className="stat__value">
                <span>16</span> <span className="stat__unit">of 18</span>
              </span>
              <span className="stat__meta">
                <span>2 returned and still open</span>
              </span>
            </div>
            <div className="stat">
              <span className="stat__label">Finalised after the freeze</span>
              <span className="stat__value">
                7 <span className="stat__unit">results</span>
              </span>
              <span className="stat__meta">Not in this cycle. They wait for the next one</span>
            </div>
          </div>
          <div
            className="progress progress--lg u-mt-4"
            role="progressbar"
            aria-label="Sample items concluded"
            aria-valuemin={0}
            aria-valuemax={18}
            aria-valuenow={16}
          >
            <div className="progress__bar" style={{ "--value": "88.9%" } as CSSProperties} />
          </div>
        </section>
        {/* Readiness checklist */}
        <section className="section" aria-labelledby="chk-h">
          <div className="section__header">
            <h2 className="text-heading" id="chk-h">
              Before you can sign off
            </h2>
          </div>
          <ul className="checklist" aria-label="Sign-off conditions">
            <li className="checklist__item checklist__item--problem">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-info" />
              </svg>
              <span className="checklist__title">All sample items concluded</span>
              <span className="tag tag--caution">16 of 18</span>
              <span className="checklist__detail">
                2 items are not concluded. They are the returned items listed below.
              </span>
            </li>
            <li className="checklist__item checklist__item--problem">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-info" />
              </svg>
              <span className="checklist__title">No returned items outstanding</span>
              <span className="tag tag--caution">2 outstanding</span>
              <span className="checklist__detail">
                1 is waiting for the assessor. 1 is re-marked and waiting for your review.
              </span>
            </li>
            <li className="checklist__item checklist__item--pass">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-check-circle" />
              </svg>
              <span className="checklist__title">You are eligible to sign off this cycle</span>
              <span className="tag tag--positive">Yes</span>
              <span className="checklist__detail">You took no assessment decision on any sampled result.</span>
            </li>
            <li className="checklist__item checklist__item--pass">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-check-circle" />
              </svg>
              <span className="checklist__title">Cohort observations recorded</span>
              <span className="tag tag--positive">1 recorded</span>
              <span className="checklist__detail">Optional. You can add more below until you sign off.</span>
            </li>
          </ul>
        </section>
        {/* Outstanding returns: FR-510 */}
        <section className="section" id="outstanding" aria-labelledby="out-h" tabIndex={-1}>
          <div className="section__header">
            <h2 className="text-heading" id="out-h">
              Returned items still open (2)
            </h2>
            <span className="text-small text-muted">As at Tue 22 Sep 2026, 16:10 SAST</span>
          </div>
          <div className="table-wrap">
            <table className="table table--cards">
              <caption className="u-visually-hidden">
                Returned sample items that block sign-off, with who must act next and the re-mark deadline
              </caption>
              <thead>
                <tr>
                  <th scope="col">Learner and item</th>
                  <th scope="col">Who must act next</th>
                  <th scope="col">Returned (SAST)</th>
                  <th scope="col">Re-mark due</th>
                  <th scope="col">State</th>
                  <th scope="col" className="table__actions">
                    <span className="u-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="table__primary-cell" data-label="Learner and item">
                    <span className="table__primary">Naledi Khoza</span>
                    <span className="table__secondary">Item 7 of 18 · Task 3: Workplace records portfolio</span>
                  </td>
                  <td data-label="Who acts next">
                    Nomvula Mahlangu
                    <span className="table__secondary">Assessor: must re-mark</span>
                  </td>
                  <td data-label="Returned">
                    <time className="datetime" dateTime="2026-09-21T11:05:00+02:00">
                      21 Sep 2026, <span className="datetime__time">11:05</span>
                    </time>
                  </td>
                  <td data-label="Re-mark due">
                    <span className="deadline">
                      <svg className="icon icon--sm" aria-hidden="true">
                        <use href="#i-clock" />
                      </svg>
                      End of Fri 25 Sep 2026 · in 3 days
                    </span>
                  </td>
                  <td data-label="State">
                    <span className="tag tag--caution">Waiting for assessor</span>
                  </td>
                  <td className="table__actions">
                    <Link className="btn btn--secondary btn--sm" href="/moderate/cycles/cycle-1/items/item-7">
                      Open item
                      <span className="u-visually-hidden"> 7, Naledi Khoza</span>
                    </Link>
                  </td>
                </tr>
                <tr>
                  <td className="table__primary-cell" data-label="Learner and item">
                    <span className="table__primary">Kagiso Molefe</span>
                    <span className="table__secondary">Item 15 of 18 · Task 3: Workplace records portfolio</span>
                  </td>
                  <td data-label="Who acts next">
                    You
                    <span className="table__secondary">Moderator: review the re-mark by Nomvula Mahlangu</span>
                  </td>
                  <td data-label="Returned">
                    <time className="datetime" dateTime="2026-09-18T15:30:00+02:00">
                      18 Sep 2026, <span className="datetime__time">15:30</span>
                    </time>
                  </td>
                  <td data-label="Re-mark due">
                    <span className="deadline deadline--closed">
                      <svg className="icon icon--sm" aria-hidden="true">
                        <use href="#i-check" />
                      </svg>
                      Re-marked 22 Sep 2026, before the end of 23 Sep
                    </span>
                  </td>
                  <td data-label="State">
                    <span className="tag tag--info">Re-marked. Review again</span>
                  </td>
                  <td className="table__actions">
                    <Link className="btn btn--secondary btn--sm" href="/moderate/cycles/cycle-1/items/item-7">
                      Review again
                      <span className="u-visually-hidden">: item 15, Kagiso Molefe</span>
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-small text-muted u-mt-2">
            If a deadline passes, the item shows as overdue to you, the assessor and the coordinator. Nothing is
            released automatically. Zanele Dlamini can reallocate the assessor.
          </p>
        </section>
        {/* Cycle summary: scope, population, sample, audit values */}
        <section className="section" aria-labelledby="sum-h">
          <div className="section__header">
            <h2 className="text-heading" id="sum-h">
              Cycle summary
            </h2>
          </div>
          <div className="grid grid--2">
            <div className="card">
              <div className="card__header">
                <h3 className="card__title">Scope and population</h3>
              </div>
              <div className="card__body">
                <dl className="dl">
                  <div className="dl__row">
                    <dt>Scope</dt>
                    <dd>Task 3: Workplace records portfolio, Unit 3 (8 credits)</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Cohort</dt>
                    <dd>2026 Intake C · Certificate in Business Administration</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Planned by</dt>
                    <dd>Zanele Dlamini, coordinator, Mon 14 Sep 2026</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Frozen and sampled</dt>
                    <dd>
                      <time dateTime="2026-09-18T09:00:00+02:00">Fri 18 Sep 2026, 09:00 SAST</time>, automatically, as
                      scheduled
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Frozen population</dt>
                    <dd>
                      64 results: every decision in scope that was finalised and waiting at the freeze. 59 Competent, 5
                      Not yet competent.
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Moderator</dt>
                    <dd>Thandiwe Nkosi, all 18 items. No item needed another moderator.</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div className="card">
              <div className="card__header">
                <h3 className="card__title">Sample record, for audit</h3>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  data-toast="Sample record copied"
                  data-toast-meta="rule-v4 · seed 5520913"
                >
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-copy" />
                  </svg>
                  Copy
                </button>
              </div>
              <div className="card__body">
                <dl className="dl">
                  <div className="dl__row">
                    <dt>Sample size</dt>
                    <dd>18 of 64 (28%)</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Mandatory inclusions</dt>
                    <dd>5 Not yet competent decisions · 3 first-time assessor decisions (Nomvula Mahlangu)</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Random within strata</dt>
                    <dd>10 (15% of 64, rounded up)</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Rule version</dt>
                    <dd>
                      <code className="mono">{"rule-v4"}</code>
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Seed</dt>
                    <dd>
                      <code className="mono">{"5520913"}</code> (generated by the server)
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Population digest</dt>
                    <dd>
                      <code className="mono">{"sha256:9f2c41d7a06be3185c7d…e44b"}</code>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
          <div className="table-wrap u-mt-4" tabIndex={0} role="region" aria-labelledby="strata-cap">
            <table className="table table--compact">
              <caption className="u-visually-hidden" id="strata-cap">
                Sampling strata: population and sample counts. Scrolls sideways on small screens.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Stratum (assessor · outcome · unit)</th>
                  <th scope="col" className="table__num">
                    Population
                  </th>
                  <th scope="col" className="table__num">
                    Mandatory
                  </th>
                  <th scope="col" className="table__num">
                    Random
                  </th>
                  <th scope="col" className="table__num">
                    Sampled
                  </th>
                  <th scope="col" className="table__num">
                    Concluded
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">N. Mahlangu · Competent · Unit 3</th>
                  <td className="table__num">59</td>
                  <td className="table__num">
                    3 <span className="table__secondary">first-time assessor</span>
                  </td>
                  <td className="table__num">10</td>
                  <td className="table__num">13</td>
                  <td className="table__num">
                    <span>12</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">N. Mahlangu · Not yet competent · Unit 3</th>
                  <td className="table__num">5</td>
                  <td className="table__num">
                    5 <span className="table__secondary">every NYC decision</span>
                  </td>
                  <td className="table__num">0</td>
                  <td className="table__num">5</td>
                  <td className="table__num">
                    <span>4</span>
                  </td>
                </tr>
                <tr>
                  <th scope="row">Total</th>
                  <td className="table__num">64</td>
                  <td className="table__num">8</td>
                  <td className="table__num">10</td>
                  <td className="table__num">18</td>
                  <td className="table__num">
                    <span>16</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-small text-muted u-mt-2">
            <abbr title="Not yet competent">NYC</abbr> means Not yet competent. The sample cannot be redrawn.
          </p>
        </section>
        {/* Observations for the coordinator: FR-508 */}
        <section className="section" aria-labelledby="obs-h">
          <div className="section__header">
            <h2 className="text-heading" id="obs-h">
              Observations about the cohort, for the coordinator
            </h2>
          </div>
          <ol className="log log--boxed" aria-label="Observations recorded in this cycle, oldest first. Times in SAST.">
            <li className="log__item">
              <time className="log__time" dateTime="2026-09-22T15:02:00+02:00">
                22 Sep 2026, 15:02
              </time>
              <div className="log__event">
                <span className="log__actor">Thandiwe Nkosi</span> recorded an observation. AC 3.2 (controlling access)
                is the most common gap: 4 of the 5 Not yet competent decisions turn on an access register with no
                approval column. The task brief could show an example register. Marking of AC 3.1 was cautious in two
                items; both were corrected on re-mark.
              </div>
            </li>
          </ol>
          <form className="form u-mt-4 pg-signoff">
            <div className="field">
              <label className="field__label" htmlFor="obs-text">
                Add an observation <span className="field__optional">(optional)</span>
              </label>
              <p className="field__help" id="obs-text-h">
                About the cohort or the marking as a whole, not about one learner. Zanele Dlamini reads these on the
                cycle page. Observations are added to the record and are not edited.
              </p>
              <textarea className="textarea" id="obs-text" rows={4} aria-describedby="obs-text-h" />
            </div>
            <div className="form__actions">
              <button
                type="button"
                className="btn btn--secondary"
                data-toast="Observation recorded"
                data-toast-meta="Visible to Zanele Dlamini on the cycle page"
              >
                Record observation
              </button>
            </div>
          </form>
        </section>
        {/* What sign-off will do */}
        <section className="section" aria-labelledby="do-h">
          <div className="section__header">
            <h2 className="text-heading" id="do-h">
              What sign-off will do
            </h2>
          </div>
          <div className="card">
            <div className="card__body stack">
              <ul className="pg-list">
                <li>
                  <strong>Release exactly 64 results</strong> to learners in 2026 Intake C: the population frozen on Fri
                  18 Sep 2026. Sampled or not, all 64 are released together.
                </li>
                <li>
                  <strong>Start each learner&apos;s seven-day appeal window</strong>{" "}
                  <span>on the day you sign off. It is 7 calendar days, including weekends and public holidays.</span>
                </li>
                <li>
                  <strong>Start the resubmission period</strong> for the 5 Not yet competent results.{" "}
                  <span>Each period runs from the day of release, so the time held has not used any of it.</span>
                </li>
                <li>
                  <strong>Award credits.</strong> Credit is evaluated for the 59 Competent results. A learner who has
                  now completed Unit 3 is awarded its 8 credits.
                </li>
                <li>
                  <strong>Notify 64 learners</strong>, in the LMS and by email: &quot;Your result for Task 3 is
                  ready&quot;.
                </li>
              </ul>
              <div className="banner banner--info banner--compact" role="note">
                <svg className="icon banner__icon" aria-hidden="true">
                  <use href="#i-lock" />
                </svg>
                <p className="banner__body">
                  <strong>Not released: 7 results finalised after the freeze.</strong> They were never eligible for this
                  sample, so they stay held and wait for the next cycle. Zanele Dlamini sees them in the pending pool.
                </p>
              </div>
              <p className="text-small">
                <strong>Sign-off cannot be undone.</strong> A released result cannot be taken back.
              </p>
            </div>
          </div>
        </section>
        {/* Sign-off: blocked */}
        <section className="section" aria-labelledby="sob-h">
          <div className="section__header">
            <h2 className="text-heading" id="sob-h">
              Sign off and release
            </h2>
          </div>
          <form className="form pg-signoff">
            <div className="field">
              <label className="field__label" htmlFor="sob-statement">
                Sign-off statement <span className="field__required">(required)</span>
              </label>
              <textarea className="textarea" id="sob-statement" rows={4} disabled aria-describedby="so-blocked" />
            </div>
            <label className="check">
              <input className="check__input" type="checkbox" id="sob-ack" disabled aria-describedby="so-blocked" />
              <span className="check__label">I did not assess any item that I moderated in this cycle.</span>
            </label>
            <div className="form__actions">
              <button type="button" className="btn btn--primary" disabled aria-describedby="so-blocked">
                Sign off and release 64 results
              </button>
            </div>
            <p className="blocked-reason" id="so-blocked">
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-info" />
              </svg>
              <span>
                You cannot sign off yet: 2 returned items are still open. Item 7 (Naledi Khoza) is with Nomvula
                Mahlangu, due by the end of Fri 25 Sep 2026. Item 15 (Kagiso Molefe) is waiting for your review.{" "}
                <a href="#outstanding">See both items</a>
              </span>
            </p>
          </form>
        </section>
        {/* Sign-off: ready */}
        {/* Signed off: read-only record */}
      </div>
    </>
  );
}
