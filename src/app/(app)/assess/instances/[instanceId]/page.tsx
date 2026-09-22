import "./page.css";

export const metadata = { title: "Mark Task 3, Lerato Mokoena · Assessing" };

// Ported from docs/design/ui/prototype/assess-marking.html (default state). Static shell: no data or behaviour yet.
export default function AssessMarkingPage() {
  return (
    <>
      <div className="pg-head">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <a href="#main">Queue</a>
              </li>
              <li>
                <a href="#main">
                  <span>Task 3</span>
                </a>
              </li>
              <li aria-current="page">
                <span>Lerato Mokoena</span>
              </li>
            </ol>
          </nav>
          <p className="page-header__workspace">Assessing</p>
          <h1 className="page-header__title">
            <span>Task 3: Workplace records portfolio</span>
          </h1>
          <div className="page-header__meta">
            <span className="tag tag--info tag--shape-half">Marking, draft saved 10:40</span>{" "}
            <span>
              Lerato Mokoena · <span className="mono">KSI-2026-0417</span> · 2026 Intake B{" "}
              <span className="tag tag--plain">Moderated</span>
            </span>{" "}
            <span>Version 2 of 2, submitted 4 Sep 2026 at 17:42, Late</span>{" "}
          </div>
          <div className="page-header__actions">
            <button
              type="button"
              className="btn btn--secondary u-hide-phone"
              data-density-toggle="#main"
              aria-pressed="false"
            >
              Compact density
            </button>
            <details className="menu-wrap" data-menu="">
              <summary className="btn btn--secondary btn--icon" aria-label="More actions">
                <svg className="icon" aria-hidden="true">
                  <use href="#i-dots" />
                </svg>
              </summary>
              <div className="menu menu--end">
                <button type="button" className="menu__item">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-download" />
                  </svg>
                  Open original files
                </button>
                <a className="menu__item" href="#main">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-arrow-left" />
                  </svg>
                  Back to the queue
                </a>
              </div>
            </details>
          </div>
        </header>
        {/* Page banners: a state that colours the whole page. */}
      </div>
      <nav className="section-switcher" aria-label="Sections of this item">
        <a className="section-switcher__item" href="#ws-evidence" aria-current="true">
          Evidence
        </a>{" "}
        <a className="section-switcher__item" href="#ws-history">
          History
        </a>{" "}
        <a className="section-switcher__item" href="#ws-rubric">
          Rubric
        </a>{" "}
        <a className="section-switcher__item" href="#ws-feedback">
          Feedback
        </a>{" "}
        <a className="section-switcher__item" href="#ws-decision">
          Decision
        </a>
      </nav>
      <div className="workspace">
        {/* =================== LEFT: evidence, integrity, history =================== */}
        <div className="workspace__evidence">
          <section id="ws-evidence" className="stack" aria-labelledby="ev-h" tabIndex={-1}>
            <h2 className="text-subheading" id="ev-h">
              Evidence
            </h2>
            {/* Coursework item */}
            <div className="stack">
              <div className="cluster cluster--between">
                <label className="select">
                  <span className="u-visually-hidden">Version to view</span>
                  <select id="ev-version">
                    <option>Version 2 (being assessed), 4 Sep 2026, 17:42, Late</option>
                    <option>Version 1, 28 Aug 2026, 16:55 (read-only)</option>
                  </select>
                </label>{" "}
                <span className="cluster">
                  <span className="tag tag--caution">Late by 42 minutes</span>
                  <span className="text-meta">3 files · 17.3 MB · SUB-2026-0904-7K2M</span>
                </span>
              </div>
              <div className="tabs" data-tabs="">
                <div className="tabs__list" role="tablist" aria-label="Evidence files, by evidence requirement">
                  <button
                    type="button"
                    className="tabs__tab"
                    role="tab"
                    id="t-ev1"
                    aria-controls="p-ev1"
                    aria-selected="true"
                  >
                    1. Portfolio
                  </button>{" "}
                  <button
                    type="button"
                    className="tabs__tab"
                    role="tab"
                    id="t-ev2"
                    aria-controls="p-ev2"
                    aria-selected="false"
                  >
                    2. Filing index
                  </button>{" "}
                  <button
                    type="button"
                    className="tabs__tab"
                    role="tab"
                    id="t-ev3"
                    aria-controls="p-ev3"
                    aria-selected="false"
                  >
                    3. Retention schedule
                  </button>{" "}
                  <button
                    type="button"
                    className="tabs__tab"
                    role="tab"
                    id="t-ev4"
                    aria-controls="p-ev4"
                    aria-selected="false"
                  >
                    4. Access register <span className="tabs__count">0</span>
                  </button>
                </div>
                <div className="tabs__panel" role="tabpanel" id="p-ev1" aria-labelledby="t-ev1" tabIndex={0}>
                  <div className="viewer">
                    <div className="viewer__toolbar">
                      <div className="cluster">
                        <span className="text-subheading">Workplace-records-portfolio-v2.pdf</span>
                        <span className="text-meta">Page 6 of 11 · 4.2 MB</span>
                      </div>
                      <div className="cluster">
                        <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label="Previous page">
                          <svg className="icon icon--sm" aria-hidden="true">
                            <use href="#i-caret-left" />
                          </svg>
                        </button>
                        <button type="button" className="btn btn--ghost btn--icon btn--sm" aria-label="Next page">
                          <svg className="icon icon--sm" aria-hidden="true">
                            <use href="#i-caret-right" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <div className="viewer__body">
                      <div className="viewer__page prose">
                        <h3>3. Controlling access to confidential records</h3>
                        <p>
                          Payroll and leave records are kept in the locked cabinet in the HR office. A request to see a
                          record is written in the access register and approved by the office manager before the cabinet
                          is opened.
                        </p>
                        <p>
                          Only the HR administrator and the office manager hold a key. When a record is taken out, the
                          register shows who took it, why, and when it was put back.
                        </p>
                        <blockquote>
                          The access register for July and August 2026 is attached as evidence for requirement 4.
                        </blockquote>
                        <h3>4. Keeping and destroying records</h3>
                        <p>
                          Payroll records are kept for five years and leave records for three years after the employee
                          leaves. The retention schedule in requirement 3 lists each record type, where it is kept and
                          when it may be destroyed.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="tabs__panel" role="tabpanel" id="p-ev2" aria-labelledby="t-ev2" tabIndex={0} hidden>
                  <div className="viewer">
                    <div className="viewer__toolbar">
                      <div className="cluster">
                        <span className="text-subheading">Filing-index-v2.docx</span>
                        <span className="text-meta">Page 1 of 4 · 12.0 MB</span>
                      </div>
                    </div>
                    <div className="viewer__body">
                      <div className="viewer__page prose">
                        <h3>Filing index: HR office, cabinet 2</h3>
                        <p>
                          Drawer A: payroll, by month, newest at the front. Drawer B: leave forms, by surname, then by
                          year. Drawer C: contracts, by employee number.
                        </p>
                        <p>
                          Sample used for this portfolio: five records chosen by the office manager on 24 August 2026.
                          Each was found from this index and the time taken was written down.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="tabs__panel" role="tabpanel" id="p-ev3" aria-labelledby="t-ev3" tabIndex={0} hidden>
                  <div className="viewer">
                    <div className="viewer__toolbar">
                      <div className="cluster">
                        <span className="text-subheading">Retention-schedule.xlsx</span>
                        <span className="text-meta">Sheet 1 of 1 · 1.1 MB</span>
                      </div>
                    </div>
                    <div className="viewer__body">
                      <div className="viewer__page prose">
                        <h3>Retention schedule</h3>
                        <p>
                          Payroll records: 5 years, drawer A, shredded on site. Leave records: 3 years after the
                          employee leaves, drawer B. Contracts: 5 years after the contract ends, drawer C.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="tabs__panel" role="tabpanel" id="p-ev4" aria-labelledby="t-ev4" tabIndex={0} hidden>
                  <div className="card">
                    <div className="empty">
                      <span className="empty__icon">
                        <svg className="icon icon--lg" aria-hidden="true">
                          <use href="#i-file" />
                        </svg>
                      </span>
                      <p className="empty__title">No file for this requirement</p>
                      <p className="empty__body">
                        Requirement 4, the access register, has no file in version 2 or in version 1. The portfolio
                        refers to it on page 6.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Exam item */}
          </section>
          {/* Integrity: exams only */}
          {/* History: versions and decisions */}
          <section id="ws-history" className="stack" aria-labelledby="hs-h" tabIndex={-1}>
            <h2 className="text-subheading" id="hs-h">
              History
            </h2>
            <ol className="history-list" aria-label="Submission versions, newest first">
              <li className="history-list__item is-current">
                <span className="history-list__badge">v2</span>
                <span className="history-list__title">
                  Version 2, resubmitted before marking <span className="tag tag--caution">Late</span>
                </span>
                <span className="history-list__meta">
                  4 Sep 2026, 17:42 · 42 minutes after the due time of 17:00 · 3 files · 17.3 MB
                </span>
                <span className="history-list__actions">
                  <span className="tag tag--plain">Being assessed</span>
                </span>
              </li>
              <li className="history-list__item">
                <span className="history-list__badge">v1</span>
                <span className="history-list__title">
                  Version 1 <span className="tag tag--shape-square">In version history</span>
                </span>
                <span className="history-list__meta">
                  28 Aug 2026, 16:55 · on time · 2 files · 9.8 MB · replaced by version 2, kept on record
                </span>
                <span className="history-list__actions">
                  <a className="btn btn--ghost btn--sm" href="#ws-evidence">
                    View
                    <span className="u-visually-hidden"> version 1, read-only</span>
                  </a>
                </span>
              </li>
            </ol>
            <h3 className="text-small text-muted">Decisions on this result</h3>
            <p className="text-small">
              No decision has been recorded yet. Your marks and comments are a draft until you finalise.
            </p>
          </section>
        </div>
        {/* =================== RIGHT: rubric, feedback, decision =================== */}
        <div className="workspace__panel">
          {/* Re-mark: the original decision stays visible beside the new form */}
          <form className="rubric" id="ws-rubric" aria-labelledby="rb-h" tabIndex={-1}>
            <h2 className="text-subheading" id="rb-h">
              <span>Rubric for Unit 3</span>
            </h2>
            <div className="rubric">
              <fieldset className="rubric__row">
                <legend className="rubric__head">
                  <span>
                    <span className="rubric__id">AC 3.1</span>{" "}
                    <span className="rubric__title" id="c31-t">
                      Maintains a filing index that others can use
                    </span>
                  </span>
                  <span className="rubric__score">3 / 4</span>
                </legend>
                <p className="rubric__desc">Records in the sample can be found from the index without help.</p>
                <div className="rubric__levels" role="radiogroup" aria-labelledby="c31-t">
                  <label className="choice">
                    <input className="choice__input" type="radio" name="c31" value="0" />
                    <span className="choice__title">Not shown</span>
                    <span className="choice__meta">0</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="c31" value="2" />
                    <span className="choice__title">Partly</span>
                    <span className="choice__meta">2</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="c31" value="3" defaultChecked />
                    <span className="choice__title">Meets</span>
                    <span className="choice__meta">3</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="c31" value="4" />
                    <span className="choice__title">Exceeds</span>
                    <span className="choice__meta">4</span>
                  </label>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="c31-c">
                    Comment for AC 3.1 <span className="field__optional">(optional)</span>
                  </label>
                  <textarea
                    className="textarea"
                    id="c31-c"
                    rows={2}
                    defaultValue={"Every sampled record was found from the index (filing index, page 1)."}
                  />
                </div>
              </fieldset>
              <fieldset className="rubric__row">
                <legend className="rubric__head">
                  <span>
                    <span className="rubric__id">AC 3.2</span>{" "}
                    <span className="rubric__title" id="c32-t">
                      Controls access to confidential records
                    </span>
                  </span>
                  <span className="rubric__score">2 / 4</span>
                </legend>
                <p className="rubric__desc">Evidence that access is requested, approved and recorded.</p>
                <div className="rubric__levels" role="radiogroup" aria-labelledby="c32-t">
                  <label className="choice">
                    <input className="choice__input" type="radio" name="c32" value="0" />
                    <span className="choice__title">Not shown</span>
                    <span className="choice__meta">0</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="c32" value="2" defaultChecked />
                    <span className="choice__title">Partly</span>
                    <span className="choice__meta">2</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="c32" value="3" />
                    <span className="choice__title">Meets</span>
                    <span className="choice__meta">3</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="c32" value="4" />
                    <span className="choice__title">Exceeds</span>
                    <span className="choice__meta">4</span>
                  </label>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="c32-c">
                    Comment for AC 3.2 <span className="field__optional">(optional)</span>
                  </label>
                  <textarea
                    className="textarea"
                    id="c32-c"
                    rows={2}
                    defaultValue={
                      "The process is described on page 6, but the access register itself is not among the files."
                    }
                  />
                </div>
              </fieldset>
            </div>
            <div className="rubric__total">
              <span>
                Total <span className="text-muted">(2 of 2 criteria scored)</span>
              </span>{" "}
              <span className="rubric__total-value">
                <span>5 / 8</span>
              </span>
            </div>
          </form>
          <form id="ws-feedback" className="stack" aria-labelledby="fb-h" tabIndex={-1}>
            <h2 className="text-subheading" id="fb-h">
              Feedback
            </h2>
            <div className="field">
              <label className="field__label" htmlFor="fb-text">
                Overall feedback for the learner <span className="field__optional">(optional)</span>
              </label>
              <p className="field__help" id="fb-text-h">
                Shown to the learner as &quot;Feedback from your assessor, Thandiwe Nkosi&quot; when the result is
                released.
              </p>
              <textarea
                className="textarea textarea--feedback"
                id="fb-text"
                aria-describedby="fb-text-h"
                defaultValue={
                  "Lerato, your filing index is clear and every record in the sample can be found from it. The retention schedule is correct for payroll and leave records. To meet criterion 3.2 you still need to show how access to confidential records is controlled: add the access register you describe on page 6 and explain who approves a request."
                }
              />
            </div>
          </form>
          {/* Decision: editable form */}
          <form className="decision" id="ws-decision" aria-labelledby="decision-title" tabIndex={-1}>
            <div className="decision__header">
              <h2 className="decision__title" id="decision-title">
                <span>Competency decision</span>
              </h2>
              <p className="text-small text-muted">
                A decision is never edited. A later change is recorded as a new decision and the earlier one stays on
                record.
              </p>
            </div>
            <div className="decision__body">
              <fieldset className="fieldset">
                <legend className="fieldset__legend">
                  Outcome <span className="field__required">(required)</span>
                </legend>
                <div className="choice-group choice-group--2">
                  <label className="choice choice--positive">
                    <input className="choice__input" type="radio" name="outcome" value="c" />
                    <span className="choice__title">Competent</span>
                    <span className="choice__desc">All assessment criteria for the unit are met.</span>
                  </label>{" "}
                  <label className="choice choice--caution">
                    <input className="choice__input" type="radio" name="outcome" value="nyc" defaultChecked />
                    <span className="choice__title">Not yet competent</span>
                    <span className="choice__desc">One or more criteria are not yet met. The learner resubmits.</span>
                  </label>
                </div>
              </fieldset>
              <div className="field">
                <label className="field__label" htmlFor="d-just">
                  Justification <span className="field__required">(required)</span>
                </label>
                <p className="field__help" id="d-just-h">
                  The learner and the moderator read this. Say which criteria were met, which were not, and why.
                </p>
                <textarea
                  className="textarea textarea--feedback"
                  id="d-just"
                  required
                  aria-describedby="d-just-h"
                  defaultValue={
                    "AC 3.1 is met: every sampled record was found from the filing index. AC 3.2 is not yet met: the access register is described on page 6 but is not among the evidence files, so there is no evidence that access is requested, approved and recorded."
                  }
                />
              </div>
              <div className="decision__remediation" id="d-remediation">
                <p className="text-subheading">Needed for a Not yet competent outcome</p>
                <div className="field">
                  <label className="field__label" htmlFor="d-rem">
                    What the learner must do <span className="field__required">(required)</span>
                  </label>
                  <textarea
                    className="textarea"
                    id="d-rem"
                    rows={3}
                    required
                    defaultValue={
                      "Upload the access register for July and August 2026, and add one paragraph on who approves a request."
                    }
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="d-period">
                    Resubmission period, in days from release <span className="field__required">(required)</span>
                  </label>
                  <p className="field__help" id="d-period-h">
                    A period, not a date. It starts on the day the result is released, so time spent held for moderation
                    does not use any of it up. <span>The date is set when the result is released.</span>{" "}
                  </p>
                  <input
                    className="input pg-period"
                    id="d-period"
                    type="number"
                    min="1"
                    max="90"
                    defaultValue="14"
                    inputMode="numeric"
                    required
                    aria-describedby="d-period-h"
                  />
                </div>
              </div>
              <div className="banner banner--info banner--compact" role="note">
                <svg className="icon banner__icon" aria-hidden="true">
                  <use href="#i-lock" />
                </svg>
                <p className="banner__body">
                  2026 Intake B is moderated. When you finalise, this result will be <strong>held</strong>. The learner
                  will not see it until a moderator signs off.
                </p>
              </div>
            </div>
            <div className="decision__footer">
              <span className="decision__attribution">You are deciding as the assessor: Thandiwe Nkosi</span>
              <span className="status-line status-line--saved" role="status">
                <svg className="icon" aria-hidden="true">
                  <use href="#i-cloud-check" />
                </svg>
                Draft saved <span className="status-line__time">10:40</span>
              </span>
            </div>
          </form>
          {/* Decision: read-only record after finalise */}
        </div>
      </div>
      <div className="decision-bar" role="region" aria-label="Decision">
        <div className="decision-bar__summary">
          <strong>Not yet competent · 5 / 8</strong>
          All criteria scored. Draft saved 10:40
        </div>
        <div className="decision-bar__actions">
          <button type="button" className="btn btn--secondary">
            Save draft
          </button>
          <button type="button" className="btn btn--primary" data-modal-open="m-finalise-held">
            Finalise decision
          </button>
        </div>
        <button type="button" className="btn btn--primary decision-bar__open" data-modal-open="m-decision-sheet">
          Decision
        </button>{" "}
      </div>
    </>
  );
}
