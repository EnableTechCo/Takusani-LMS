import Link from "next/link";

export const metadata = { title: "Sampling percentage" };

// Ported from docs/design/ui/prototype/admin-configuration-key.html (default state). Static shell: no data or behaviour yet.
export default function AdminConfigurationKeyPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/admin/configuration">Configuration</Link>
              </li>
              <li>Moderation sampling</li>
              <li aria-current="page">Sampling percentage</li>
            </ol>
          </nav>
          <p className="page-header__workspace">Administration</p>
          <h1 className="page-header__title">Sampling percentage</h1>
          <p className="page-header__lead">
            The share of Competent results drawn at random into each moderation sample, on top of the mandatory
            inclusions.
          </p>
          <div className="page-header__meta">
            <span className="tag tag--positive tag--shape-dot">In force: 15% (version 4)</span>{" "}
            <span className="text-meta">moderation.sampling.percentage</span>
            <span className="text-meta">As at Mon 21 Sep 2026, 11:30 SAST</span>
          </div>
        </header>
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            <section aria-labelledby="cur-h">
              <h2 className="u-visually-hidden" id="cur-h">
                Value in force
              </h2>
              <div className="grid grid--2">
                <div className="stat">
                  <span className="stat__label">Value in force now</span>
                  <span className="stat__value">
                    15
                    <span className="stat__unit">%</span>
                  </span>
                  <span className="stat__meta">
                    Version 4 · from Wed 1 Jul 2026 · recorded by Sibusiso Khumalo · previous value 10%
                  </span>
                </div>
                <div className="stat">
                  <span className="stat__label">Next value</span>
                  <span className="stat__value">None</span>
                  <span className="stat__meta">No change is scheduled.</span>
                </div>
              </div>
            </section>
            {/* ===== scheduled: result ===== */}
            {/* ===== form: default ===== */}
            <section aria-labelledby="new-h">
              <div className="section__header">
                <h2 className="text-heading" id="new-h">
                  Record a new value
                </h2>
              </div>
              <form className="form card" noValidate>
                <div className="card__body form">
                  <div className="banner banner--info banner--compact" role="note">
                    <svg className="icon banner__icon" aria-hidden="true">
                      <use href="#i-info" />
                    </svg>
                    <p className="banner__body">
                      This value is supplied in writing by the quality-assurance authority. Record the reference of
                      their letter in the reason.
                    </p>
                  </div>
                  <div className="form__row form__row--2">
                    <div className="field">
                      <label className="field__label" htmlFor="nv-value">
                        New value, as a percentage <span className="field__required">(required)</span>
                      </label>
                      <p className="field__help" id="nv-value-help">
                        A whole number from 5 to 100. The value in force is 15.
                      </p>
                      <input
                        className="input"
                        id="nv-value"
                        type="number"
                        min="5"
                        max="100"
                        step="1"
                        defaultValue="20"
                        inputMode="numeric"
                        aria-describedby="nv-value-help"
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="nv-date">
                        Takes effect at the start of <span className="field__required">(required)</span>
                      </label>
                      <p className="field__help" id="nv-date-help">
                        Today for an immediate change, or a later day. It cannot be in the past.
                      </p>
                      <input
                        className="input"
                        id="nv-date"
                        type="date"
                        defaultValue="2026-10-01"
                        min="2026-09-21"
                        aria-describedby="nv-date-help"
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="nv-reason">
                      Reason <span className="field__required">(required)</span>
                    </label>
                    <p className="field__help" id="nv-reason-help">
                      Kept with the version for auditors. Say who asked for the change and quote their reference.
                    </p>
                    <textarea
                      className="textarea"
                      id="nv-reason"
                      rows={3}
                      aria-describedby="nv-reason-help"
                      defaultValue={
                        "Quality-assurance authority letter QA/2026/118 of 14 Sep 2026: raise random sampling to 20% for the remainder of 2026 after the Term 2 verification visit."
                      }
                    />
                  </div>
                  <div className="form__actions">
                    <button type="button" className="btn btn--primary" data-modal-open="m-confirm">
                      Review the change
                    </button>
                    <button type="button" className="btn btn--ghost">
                      Show a failed attempt
                    </button>
                  </div>
                </div>
              </form>
            </section>
            {/* ===== form: invalid ===== */}
            {/* ===== what it does not affect ===== */}
            <section className="card card--sunken" aria-labelledby="not-h">
              <div className="card__header">
                <h2 className="card__title" id="not-h">
                  What a change to this setting does and does not affect
                </h2>
              </div>
              <div className="card__body">
                <dl className="dl dl--inline">
                  <div className="dl__row">
                    <dt>Affects</dt>
                    <dd>
                      Every sample drawn on or after the effective day, in every moderated cohort. Today that is 1
                      cohort: 2026 Intake B, 96 learners.
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Does not affect</dt>
                    <dd>
                      Cycles that are already frozen. &quot;Term 3 tasks&quot; (frozen Mon 14 Sep 2026) keeps rule-v4 at
                      15% and its 22 sampled items. A sample copies its configuration when it is drawn and is never
                      redrawn.
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Also unchanged</dt>
                    <dd>
                      The mandatory inclusions: every Not yet competent decision and every first-time assessor are
                      sampled whatever the percentage.
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>The same rule elsewhere</dt>
                    <dd>
                      Exam attempts that have already started keep the integrity settings they started with, for the
                      same reason.
                    </dd>
                  </div>
                </dl>
              </div>
            </section>
            {/* ===== history ===== */}
            <section aria-labelledby="hist-h">
              <div className="section__header">
                <h2 className="text-heading" id="hist-h">
                  Version history
                </h2>
                <span className="text-small text-muted">Newest first. Nothing here can be edited or deleted.</span>
              </div>
              <div className="table-wrap">
                <table className="table table--cards">
                  <caption className="u-visually-hidden">
                    Every version of the sampling percentage, newest first. Times in SAST.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Version</th>
                      <th scope="col">Value</th>
                      <th scope="col">Previous value</th>
                      <th scope="col">In force from</th>
                      <th scope="col">Until</th>
                      <th scope="col">Changed by</th>
                      <th scope="col">Reason</th>
                      <th scope="col">Recorded (SAST)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="table__primary-cell" data-label="Version">
                        <span className="table__primary">
                          Version 4 <span className="tag tag--positive tag--shape-dot">In force</span>
                        </span>
                      </td>
                      <td data-label="Value">15%</td>
                      <td data-label="Previous">10%</td>
                      <td data-label="From">Start of Wed 1 Jul 2026</td>
                      <td data-label="Until">
                        <span>
                          <span>No end date</span>
                        </span>
                      </td>
                      <td data-label="Changed by">Sibusiso Khumalo</td>
                      <td data-label="Reason">
                        Letter QA/2026/061: 15% from Term 3 after two first-time assessors joined.
                      </td>
                      <td data-label="Recorded">
                        <span className="mono">22 Jun 2026, 09:05</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Version">
                        <span className="table__primary">
                          Version 3 <span className="tag tag--shape-square">Superseded</span>
                        </span>
                      </td>
                      <td data-label="Value">10%</td>
                      <td data-label="Previous">10%, cancelled change to 12%</td>
                      <td data-label="From">Start of Mon 12 Jan 2026</td>
                      <td data-label="Until">End of Tue 30 Jun 2026</td>
                      <td data-label="Changed by">Sibusiso Khumalo</td>
                      <td data-label="Reason">Carried over for the 2026 intakes. Letter QA/2025/204.</td>
                      <td data-label="Recorded">
                        <span className="mono">9 Jan 2026, 14:20</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Version">
                        <span className="table__primary">
                          Version 2 <span className="tag tag--shape-square">Cancelled before it took effect</span>
                        </span>
                      </td>
                      <td data-label="Value">12%</td>
                      <td data-label="Previous">10%</td>
                      <td data-label="From">Was to start Mon 12 Jan 2026</td>
                      <td data-label="Until">Cancelled 9 Jan 2026</td>
                      <td data-label="Changed by">Sibusiso Khumalo</td>
                      <td data-label="Reason">
                        Recorded from a draft letter. Cancelled when the signed letter kept 10%.
                      </td>
                      <td data-label="Recorded">
                        <span className="mono">5 Jan 2026, 10:48</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Version">
                        <span className="table__primary">
                          Version 1 <span className="tag tag--shape-square">Superseded</span>
                        </span>
                      </td>
                      <td data-label="Value">10%</td>
                      <td data-label="Previous">None: first value</td>
                      <td data-label="From">Start of Mon 13 Jan 2025</td>
                      <td data-label="Until">End of Sun 11 Jan 2026</td>
                      <td data-label="Changed by">Sibusiso Khumalo</td>
                      <td data-label="Reason">Initial value at go-live. Letter QA/2024/310.</td>
                      <td data-label="Recorded">
                        <span className="mono">6 Jan 2025, 08:30</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <aside className="page-layout__aside stack" aria-label="Where this value was used">
            <h2 className="text-subheading">Samples that used this setting</h2>
            <ol className="history-list" aria-label="Cycles and the version they were frozen with, newest first">
              <li className="history-list__item is-current">
                <span className="history-list__badge">v4</span>
                <span className="history-list__title">Term 3 tasks · 2026 Intake B</span>
                <span className="history-list__meta">Frozen 14 Sep 2026 · 15% · 22 of 96 sampled · in review</span>
              </li>
              <li className="history-list__item">
                <span className="history-list__badge">v3</span>
                <span className="history-list__title">Term 2 tasks · 2026 Intake B</span>
                <span className="history-list__meta">Frozen 15 Jun 2026 · 10% · signed off 26 Jun 2026</span>
              </li>
            </ol>
            <p className="text-small text-muted">
              Each cycle shows the version it was frozen with, not the version in force today.
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
