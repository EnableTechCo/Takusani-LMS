import Link from "next/link";
import "./page.css";

export const metadata = { title: "Sample item 7 of 18 · Moderating" };

// Ported from docs/design/ui/prototype/moderate-item.html (default state). Static shell: no data or behaviour yet.
export default function ModerateItemPage() {
  return (
    <>
      <div className="pg-head">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/moderate/cycles/cycle-1/sign-off">Cycles</Link>
              </li>
              <li>
                <Link href="/moderate/cycles/cycle-1/sign-off">Unit 3 portfolios</Link>
              </li>
              <li aria-current="page">
                <span>Item 7 of 18</span>
              </li>
            </ol>
          </nav>
          <p className="page-header__workspace">Moderating</p>
          <h1 className="page-header__title">
            <span>Item 7 of 18: Naledi Khoza, Task 3</span>
          </h1>
          <div className="page-header__meta">
            <span className="tag tag--info tag--shape-half">In review</span>{" "}
            <span>
              Naledi Khoza · <span className="mono">KSI-2026-0588</span> · Task 3: Workplace records portfolio, Unit 3
            </span>{" "}
            <span>
              2026 Intake C <span className="tag tag--plain">Moderated</span> · cycle &quot;Unit 3 portfolios&quot;
            </span>
          </div>
          <div className="page-header__actions">
            <a className="btn btn--secondary" href="#main">
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-arrow-left" />
              </svg>
              Previous
              <span className="u-visually-hidden">
                {" "}
                item
                <span>, 6 of 18</span>
              </span>
            </a>{" "}
            <Link className="btn btn--secondary" href="/moderate/cycles/cycle-1/items/item-7">
              Next
              <span className="u-visually-hidden">
                {" "}
                item
                <span>, 8 of 18</span>
              </span>
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-arrow-right" />
              </svg>
            </Link>
          </div>
        </header>
        {/* Why this item is in the sample, and the independence line */}
        <section className="card" aria-labelledby="why-h">
          <div className="card__header">
            <h2 className="card__title" id="why-h">
              Why this item is in the sample
            </h2>
            <span className="text-meta">rule-v4 · seed 5520913</span>
          </div>
          <div className="card__body">
            <dl className="dl dl--inline">
              <div className="dl__row">
                <dt>Included because</dt>
                <dd>
                  <span className="tag tag--plain">Mandatory: Not yet competent decision</span> Every Not yet competent
                  decision in the frozen population is sampled.
                </dd>
              </div>
              <div className="dl__row">
                <dt>Also</dt>
                <dd>
                  <span className="tag tag--plain">First-time assessor</span> Nomvula Mahlangu has no decision in an
                  earlier signed-off cycle. 3 of her Competent decisions are included for the same reason.
                </dd>
              </div>
              <div className="dl__row">
                <dt>Stratum</dt>
                <dd>Assessor N. Mahlangu · Not yet competent · Unit 3 (5 of 5 sampled)</dd>
              </div>
              <div className="dl__row">
                <dt>Independence</dt>
                <dd>You did not assess this work. Assessor: Nomvula Mahlangu.</dd>
              </div>
              <div className="dl__row">
                <dt>Your progress</dt>
                <dd>
                  15 of your 18 items are concluded.{" "}
                  <Link href="/moderate/cycles/cycle-1/sign-off">Go to the cycle sign-off</Link>
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
      {/* BLOCKED: the page is replaced by the named conflict panel. No evidence is shown. */}
      <nav className="section-switcher" id="pg-switcher" aria-label="Sections of this item">
        <a className="section-switcher__item" href="#ws-evidence" aria-current="true">
          Evidence
        </a>{" "}
        <a className="section-switcher__item" href="#ws-assessor">
          Assessor&apos;s decision
        </a>{" "}
        <a className="section-switcher__item" href="#ws-rubric">
          Marks
        </a>{" "}
        <a className="section-switcher__item" href="#ws-finding">
          Your finding
        </a>{" "}
        <a className="section-switcher__item" href="#ws-findings">
          History
        </a>
      </nav>
      {/* FR-507: submission, evidence, rubric, the assessor's marks and the decision on ONE route */}
      <div className="workspace">
        <div className="workspace__evidence">
          <section id="ws-evidence" className="stack" aria-labelledby="ev-h" tabIndex={-1}>
            <h2 className="text-subheading" id="ev-h">
              Submission and evidence
            </h2>
            <div className="cluster cluster--between">
              <span className="text-small">Version 1 of 1, submitted 10 Sep 2026 at 16:20, on time</span>
              <span className="text-meta">3 files · 11.6 MB · SUB-2026-0910-3QF8</span>
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
                  4. Access register
                </button>
              </div>
              <div className="tabs__panel" role="tabpanel" id="p-ev1" aria-labelledby="t-ev1" tabIndex={0}>
                <div className="viewer">
                  <div className="viewer__toolbar">
                    <div className="cluster">
                      <span className="text-subheading">Records-portfolio-N-Khoza.pdf</span>
                      <span className="text-meta">Page 2 of 9 · 6.4 MB</span>
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
                      <h3>2. How the filing index works</h3>
                      <p>
                        The reception office keeps supplier invoices, delivery notes and staff leave forms. I rebuilt
                        the index in August 2026. Each shelf has a letter, each box has a number, and the index lists
                        every record type against a shelf and a box.
                      </p>
                      <p>
                        To test it, my supervisor chose five records I had not filed myself. A colleague who does not
                        work in reception found all five using only the index. The longest search took under two
                        minutes. The test sheet is on page 3.
                      </p>
                      <h3>3. Who may see staff records</h3>
                      <p>
                        Leave forms are kept in a locked drawer. People ask the receptionist if they need to see one. I
                        have attached the access register for August.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="tabs__panel" role="tabpanel" id="p-ev2" aria-labelledby="t-ev2" tabIndex={0} hidden>
                <div className="viewer">
                  <div className="viewer__toolbar">
                    <div className="cluster">
                      <span className="text-subheading">Filing-index-reception.xlsx</span>
                      <span className="text-meta">Sheet 1 of 2 · 0.9 MB</span>
                    </div>
                  </div>
                  <div className="viewer__body">
                    <div className="viewer__page prose">
                      <h3>Filing index: reception office</h3>
                      <p>
                        Shelf A, boxes 1 to 6: supplier invoices by month. Shelf B, boxes 1 to 3: delivery notes by
                        supplier. Locked drawer: staff leave forms by surname.
                      </p>
                      <p>
                        Sheet 2 is the test sheet: five records, the person who searched, and the time each search took.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="tabs__panel" role="tabpanel" id="p-ev3" aria-labelledby="t-ev3" tabIndex={0} hidden>
                <div className="viewer">
                  <div className="viewer__toolbar">
                    <div className="cluster">
                      <span className="text-subheading">Retention-schedule.docx</span>
                      <span className="text-meta">Page 1 of 1 · 0.3 MB</span>
                    </div>
                  </div>
                  <div className="viewer__body">
                    <div className="viewer__page prose">
                      <h3>Retention schedule</h3>
                      <p>
                        Supplier invoices: 5 years. Delivery notes: 2 years. Leave forms: 3 years after the employee
                        leaves.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="tabs__panel" role="tabpanel" id="p-ev4" aria-labelledby="t-ev4" tabIndex={0} hidden>
                <div className="viewer">
                  <div className="viewer__toolbar">
                    <div className="cluster">
                      <span className="text-subheading">Access-register-Aug.jpg</span>
                      <span className="text-meta">Image · 4.0 MB</span>
                    </div>
                  </div>
                  <div className="viewer__body">
                    <div className="viewer__page prose">
                      <h3>Access register, August 2026 (photograph)</h3>
                      <p>
                        Four entries. Each has a date, a name and the record asked for. There is no column for who
                        approved the request, and no time of return.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="workspace__panel">
          {/* Assessor's decision(s), newest first */}
          <section id="ws-assessor" className="stack" aria-labelledby="as-h" tabIndex={-1}>
            <h2 className="text-subheading" id="as-h">
              Assessor&apos;s decision
            </h2>
            <article className="decision" aria-labelledby="orig-h">
              <div className="decision__header">
                <div className="cluster cluster--between">
                  <h3 className="decision__title" id="orig-h">
                    <span>Decision</span>
                  </h3>
                  <span className="tag tag--plain">Current</span>
                </div>
              </div>
              <div className="decision__body">
                <dl className="dl">
                  <div className="dl__row">
                    <dt>Outcome</dt>
                    <dd>
                      <span className="tag tag--caution">Not yet competent</span> <span className="mono">4 of 8</span>
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Decided</dt>
                    <dd>Wed 16 Sep 2026, 15:10 SAST, by Nomvula Mahlangu</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Released</dt>
                    <dd>Not yet. Held in this cycle</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Justification</dt>
                    <dd>
                      The index is partly usable and access control is partly shown. More evidence is needed for both
                      criteria.
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>What the learner must do</dt>
                    <dd>Submit a new filing index and a complete access register.</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Resubmission period</dt>
                    <dd>14 days from release</dd>
                  </div>
                </dl>
              </div>
            </article>
          </section>
          {/* Rubric with the assessor's marks, read-only */}
          <form className="rubric rubric--readonly" id="ws-rubric" aria-labelledby="rb-h" tabIndex={-1}>
            <h2 className="text-subheading" id="rb-h">
              Rubric and the assessor&apos;s marks <span className="text-muted">(read-only)</span>
            </h2>
            <fieldset className="rubric__row">
              <legend className="rubric__head">
                <span>
                  <span className="rubric__id">AC 3.1</span>{" "}
                  <span className="rubric__title">Maintains a filing index that others can use</span>
                </span>
                <span className="rubric__score">2 / 4</span>
              </legend>
              <p className="rubric__desc">Records in the sample can be found from the index without help.</p>
              <div className="rubric__levels">
                <label className="choice">
                  <input className="choice__input" type="radio" name="m31" disabled />
                  <span className="choice__title">Not shown</span>
                  <span className="choice__meta">0</span>
                </label>{" "}
                <label className="choice">
                  <input className="choice__input" type="radio" name="m31" disabled defaultChecked />
                  <span className="choice__title">Partly</span>
                  <span className="choice__meta">2</span>
                </label>{" "}
                <label className="choice">
                  <input className="choice__input" type="radio" name="m31" disabled />
                  <span className="choice__title">Meets</span>
                  <span className="choice__meta">3</span>
                </label>{" "}
                <label className="choice">
                  <input className="choice__input" type="radio" name="m31" disabled />
                  <span className="choice__title">Exceeds</span>
                  <span className="choice__meta">4</span>
                </label>
              </div>
              <p className="text-small">
                <strong>Assessor&apos;s comment:</strong> Index could be clearer.
              </p>
            </fieldset>
            <fieldset className="rubric__row">
              <legend className="rubric__head">
                <span>
                  <span className="rubric__id">AC 3.2</span>{" "}
                  <span className="rubric__title">Controls access to confidential records</span>
                </span>
                <span className="rubric__score">2 / 4</span>
              </legend>
              <p className="rubric__desc">Evidence that access is requested, approved and recorded.</p>
              <div className="rubric__levels">
                <label className="choice">
                  <input className="choice__input" type="radio" name="m32" disabled />
                  <span className="choice__title">Not shown</span>
                  <span className="choice__meta">0</span>
                </label>{" "}
                <label className="choice">
                  <input className="choice__input" type="radio" name="m32" disabled defaultChecked />
                  <span className="choice__title">Partly</span>
                  <span className="choice__meta">2</span>
                </label>{" "}
                <label className="choice">
                  <input className="choice__input" type="radio" name="m32" disabled />
                  <span className="choice__title">Meets</span>
                  <span className="choice__meta">3</span>
                </label>{" "}
                <label className="choice">
                  <input className="choice__input" type="radio" name="m32" disabled />
                  <span className="choice__title">Exceeds</span>
                  <span className="choice__meta">4</span>
                </label>
              </div>
              <p className="text-small">
                <strong>Assessor&apos;s comment:</strong> <span>Register attached but incomplete.</span>
              </p>
            </fieldset>
            <div className="rubric__total">
              <span>
                Assessor&apos;s total <span className="text-muted">(2 of 2 criteria scored)</span>
              </span>
              <span className="rubric__total-value">
                <span>4 / 8</span>
              </span>
            </div>
          </form>
          {/* Finding form */}
          <form className="decision" id="ws-finding" aria-labelledby="fd-h" tabIndex={-1}>
            <div className="decision__header">
              <h2 className="decision__title" id="fd-h">
                Your finding
              </h2>
              <p className="text-small text-muted">
                A finding is never edited. Each one is added to the item&apos;s history. Reasons are required whether
                you agree or disagree.
              </p>
            </div>
            <div className="decision__body">
              <fieldset className="fieldset">
                <legend className="fieldset__legend">
                  Do you agree with the assessor&apos;s decision? <span className="field__required">(required)</span>
                </legend>
                <div className="choice-group choice-group--2">
                  <label className="choice choice--positive">
                    <input className="choice__input" type="radio" name="finding" value="agree" />
                    <span className="choice__title">Agree</span>
                    <span className="choice__desc">The marks and the outcome are supported by the evidence.</span>
                  </label>{" "}
                  <label className="choice choice--caution">
                    <input className="choice__input" type="radio" name="finding" value="disagree" />
                    <span className="choice__title">Disagree</span>
                    <span className="choice__desc">
                      Something must be corrected. The item goes back to the assessor.
                    </span>
                  </label>
                </div>
              </fieldset>
              <div className="field">
                <label className="field__label" htmlFor="fd-reasons">
                  Reasons <span className="field__required">(required)</span>
                </label>
                <p className="field__help" id="fd-reasons-h">
                  Refer to the criteria and to the evidence pages. The assessor and the coordinator can read this. The
                  learner cannot.
                </p>
                <textarea
                  className="textarea textarea--feedback"
                  id="fd-reasons"
                  required
                  aria-describedby="fd-reasons-h"
                />
              </div>
              <div className="decision__remediation" id="fd-return">
                <p className="text-subheading">Return to the assessor</p>
                <div className="field">
                  <label className="field__label" htmlFor="fd-corr">
                    Required corrections <span className="field__required">(required)</span>
                  </label>
                  <p className="field__help" id="fd-corr-h">
                    Number them. The assessor must deal with each one.
                  </p>
                  <textarea className="textarea" id="fd-corr" rows={5} required aria-describedby="fd-corr-h" />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="fd-due">
                    Re-mark by the end of <span className="field__required">(required)</span>
                  </label>
                  <p className="field__help" id="fd-due-h">
                    The assessor has the whole of this day. Thursday 24 September is a public holiday.
                  </p>
                  <input
                    className="input pg-date"
                    id="fd-due"
                    type="date"
                    defaultValue="2026-09-25"
                    min="2026-09-22"
                    required
                    aria-describedby="fd-due-h"
                  />
                </div>
                <p className="text-small">
                  The assessor and the coordinator are notified. This cycle cannot be signed off until the item is
                  re-marked and you have reviewed it again. The result stays held.
                </p>
              </div>
            </div>
            <div className="decision__footer">
              <span className="decision__attribution">
                You are recording this finding as the moderator: Thandiwe Nkosi
              </span>
              <span className="status-line status-line--saved" role="status">
                <svg className="icon" aria-hidden="true">
                  <use href="#i-cloud-check" />
                </svg>
                Draft saved <span className="status-line__time">10:52</span>
              </span>
            </div>
          </form>
          {/* What was returned (read-only), while waiting */}
          {/* Findings history: append-only */}
          <section id="ws-findings" className="stack" aria-labelledby="fh-h" tabIndex={-1}>
            <h2 className="text-subheading" id="fh-h">
              Findings on this item
            </h2>
            <p className="text-small">No finding has been recorded yet.</p>
          </section>
        </div>
      </div>
      <div className="decision-bar" id="pg-bar" role="region" aria-label="Assessor's decision and your finding">
        <div className="decision-bar__summary">
          <strong>Assessor decided: Not yet competent, 4 of 8</strong>
          Nomvula Mahlangu · 16 Sep 2026 · held
        </div>
        <div className="decision-bar__actions">
          <button type="button" className="btn btn--secondary">
            Save draft
          </button>{" "}
          <button type="button" className="btn btn--primary" id="btn-agree" data-pg-next="agreed">
            Record agreement
          </button>{" "}
          <button type="button" className="btn btn--primary" id="btn-return" data-modal-open="m-return">
            Return to assessor
          </button>
        </div>
        <button type="button" className="btn btn--primary decision-bar__open" data-modal-open="m-finding-sheet">
          Your finding
        </button>{" "}
      </div>
    </>
  );
}
