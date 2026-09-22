import "./page.css";

export const metadata = { title: "Cohort setup" };

// Ported from docs/design/ui/prototype/coordinate-cohort-setup.html (default state). Static shell: no data or behaviour yet.
export default function CoordinateCohortSetupPage() {
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
              <li aria-current="page">New cohort</li>
            </ol>
          </nav>
          <p className="page-header__workspace">Coordinating</p>
          <h1 className="page-header__title">
            <span>Set up a new cohort</span>
          </h1>
          <p className="page-header__lead">
            One page, saved as you go. You can leave and come back. The cohort stays hidden from learners until you
            activate it.
          </p>
          <div className="page-header__meta">
            <span className="tag tag--shape-half">Draft, not active</span>{" "}
            <span>2027 Intake A · Certificate in Business Administration</span>{" "}
            <span className="status-line status-line--saved" role="status">
              <svg className="icon" aria-hidden="true">
                <use href="#i-cloud-check" />
              </svg>
              Draft saved <span className="status-line__time">11:42</span>
            </span>
          </div>
        </header>
        <div className="page-layout">
          <div className="page-layout__main">
            <form className="setup-sections" noValidate aria-label="Cohort setup">
              {/* ============ 1. Details ============ */}
              <section className="card" aria-labelledby="sec-details">
                <div className="card__header">
                  <h2 className="card__title" id="sec-details">
                    1. Details
                  </h2>
                </div>
                <div className="card__body form">
                  <div className="field">
                    <label className="field__label" htmlFor="c-prog">
                      Programme <span className="field__required">(required)</span>
                    </label>{" "}
                    <span className="select">
                      <select id="c-prog">
                        <option>Certificate in Business Administration, NQF Level 4 (140 credits)</option>
                      </select>
                    </span>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="c-name">
                      Cohort name <span className="field__required">(required)</span>
                    </label>
                    <p className="field__help" id="c-name-help">
                      Learners and staff see this name everywhere. Use the year and intake.
                    </p>
                    <input
                      className="input"
                      id="c-name"
                      type="text"
                      defaultValue="2027 Intake A"
                      aria-describedby="c-name-help"
                    />
                  </div>
                  <div className="form__row form__row--2">
                    <div className="field">
                      <label className="field__label" htmlFor="c-start">
                        First day <span className="field__required">(required)</span>
                      </label>
                      <input className="input" id="c-start" type="date" defaultValue="2027-01-18" />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="c-end">
                        Last day <span className="field__required">(required)</span>
                      </label>
                      <p className="field__help" id="c-end-help">
                        The cohort has the whole of this day.
                      </p>
                      <input
                        className="input"
                        id="c-end"
                        type="date"
                        defaultValue="2027-11-26"
                        aria-describedby="c-end-help"
                      />
                    </div>
                  </div>
                </div>
              </section>
              {/* ============ 2. Moderation policy ============ */}
              <section className="card" aria-labelledby="sec-policy">
                <div className="card__header">
                  <h2 className="card__title" id="sec-policy">
                    2. Moderation policy
                  </h2>
                  <span className="tag tag--caution">Not chosen</span>{" "}
                </div>
                <div className="card__body">
                  <fieldset className="fieldset" aria-describedby="pol-help">
                    <legend className="fieldset__legend">
                      How are results in this cohort released? <span className="field__required">(required)</span>
                    </legend>
                    <p className="field__help" id="pol-help">
                      <span>There is no default. Choose one before you activate the cohort.</span>
                    </p>
                    <div className="choice-group choice-group--2">
                      <label className="choice">
                        <input className="choice__input" type="radio" name="policy" id="pol-mod" value="moderated" />
                        <span className="choice__title">Moderated</span>
                        <span className="choice__desc">
                          Every result is held until a moderation cycle signs it off. Learners see nothing, not even Not
                          yet competent, until then. You must plan cycles and keep a moderator assigned.
                        </span>
                      </label>{" "}
                      <label className="choice">
                        <input
                          className="choice__input"
                          type="radio"
                          name="policy"
                          id="pol-not"
                          value="not_moderated"
                        />
                        <span className="choice__title">Not moderated</span>
                        <span className="choice__desc">
                          Each result is released to the learner as soon as the assessor decides. The learner&apos;s 7
                          days to appeal start at that moment. No second person checks the result first.
                        </span>
                      </label>
                    </div>
                  </fieldset>
                  <p className="text-small text-muted policy-note">
                    You can change this later only while no results are waiting or held.
                  </p>
                </div>
              </section>
              {/* ============ 3. People ============ */}
              <section className="card" aria-labelledby="sec-people">
                <div className="card__header">
                  <h2 className="card__title" id="sec-people">
                    3. People
                  </h2>
                  <a
                    className="btn btn--secondary btn--sm"
                    href="#main"
                    data-toast="This screen is not part of the prototype"
                  >
                    Manage people
                  </a>
                </div>
                <div className="card__body stack">
                  <div className="grid grid--2">
                    <div className="stat">
                      <span className="stat__label">Learners enrolled</span>{" "}
                      <span className="stat__value">
                        <span>84</span>
                      </span>{" "}
                      <span className="stat__meta">
                        <span>
                          Imported Mon 14 Dec 2026 by Sibusiso Khumalo, batch IMP-0058. 3 rows had problems and were not
                          imported.
                        </span>
                      </span>
                    </div>
                    <div className="stat">
                      <span className="stat__label">Staff assigned</span>
                      <span className="stat__value">4</span>
                      <span className="stat__meta">1 facilitator, 2 assessors, 1 moderator</span>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="table table--cards">
                      <caption className="u-visually-hidden">Role assignments for this cohort</caption>
                      <thead>
                        <tr>
                          <th scope="col">Person</th>
                          <th scope="col">Role in this cohort</th>
                          <th scope="col">From</th>
                          <th scope="col">Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="table__primary-cell" data-label="Person">
                            <span className="table__primary">Pieter van Wyk</span>
                          </td>
                          <td data-label="Role">Facilitator</td>
                          <td data-label="From">
                            <span>Mon 18 Jan 2027</span>
                          </td>
                          <td data-label="Note">All units</td>
                        </tr>
                        <tr>
                          <td className="table__primary-cell" data-label="Person">
                            <span className="table__primary">Thandiwe Nkosi</span>
                          </td>
                          <td data-label="Role">Assessor</td>
                          <td data-label="From">
                            <span>Mon 18 Jan 2027</span>
                          </td>
                          <td data-label="Note">All units</td>
                        </tr>
                        <tr>
                          <td className="table__primary-cell" data-label="Person">
                            <span className="table__primary">Bongani Sithole</span>
                          </td>
                          <td data-label="Role">Assessor</td>
                          <td data-label="From">
                            <span>Mon 18 Jan 2027</span>
                          </td>
                          <td data-label="Note">
                            <span>All units</span>
                          </td>
                        </tr>
                        <tr>
                          <td className="table__primary-cell" data-label="Person">
                            <span className="table__primary">Anil Naidoo</span>
                          </td>
                          <td data-label="Role">Moderator</td>
                          <td data-label="From">
                            <span>Mon 18 Jan 2027</span>
                          </td>
                          <td data-label="Note">May sign off cycles</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-small text-muted">
                    A person may assess and moderate in the same cohort. They are never given an item they assessed:
                    that is checked for each item when work is allocated.
                  </p>
                </div>
              </section>
              {/* ============ 4. Exam accommodations (decision U-02) ============ */}
              {/* ============ Review and activate ============ */}
              <section className="card" aria-labelledby="sec-review">
                <div className="card__header">
                  <h2 className="card__title" id="sec-review">
                    4. Review and activate
                  </h2>
                </div>
                <div className="card__body stack">
                  <p>1 thing is still needed before this cohort can be activated. It is listed under Readiness.</p>
                  <div className="cluster">
                    <button type="button" className="btn btn--primary" disabled aria-describedby="act-why">
                      Activate cohort
                    </button>{" "}
                    <button
                      type="button"
                      className="btn btn--secondary"
                      data-toast="Draft saved"
                      data-toast-meta="2027 Intake A"
                    >
                      Save draft
                    </button>
                  </div>
                  <p className="blocked-reason" id="act-why">
                    <svg className="icon icon--sm" aria-hidden="true">
                      <use href="#i-info" />
                    </svg>
                    You cannot activate this cohort yet: the moderation policy has not been chosen. Choose Moderated or
                    Not moderated in section 2.
                  </p>
                </div>
              </section>
            </form>
          </div>
          <aside className="page-layout__aside stack" aria-label="Readiness and policy history">
            <section aria-labelledby="ready-h">
              <h2 className="text-subheading u-mb-4" id="ready-h">
                Readiness <span className="text-muted">(4 of 5 done)</span>
              </h2>
              <ul className="checklist" aria-label="Readiness checklist">
                <li className="checklist__item checklist__item--pass">
                  <svg className="icon checklist__icon" aria-hidden="true">
                    <use href="#i-check-circle" />
                  </svg>
                  <span className="checklist__title">Programme, name and dates</span>
                  <span className="tag tag--positive">Done</span>
                </li>
                <li className="checklist__item checklist__item--problem">
                  <svg className="icon checklist__icon" aria-hidden="true">
                    <use href="#i-info" />
                  </svg>
                  <span className="checklist__title">Moderation policy confirmed</span>
                  <span className="tag tag--caution">Needed</span>
                  <span className="checklist__detail">
                    Not chosen yet. There is no default. <a href="#pol-mod">Choose a policy</a>
                  </span>
                </li>
                <li className="checklist__item checklist__item--pass">
                  <svg className="icon checklist__icon" aria-hidden="true">
                    <use href="#i-check-circle" />
                  </svg>
                  <span className="checklist__title">Learners enrolled</span>
                  <span className="tag tag--positive">Done</span>
                </li>
                <li className="checklist__item checklist__item--pass">
                  <svg className="icon checklist__icon" aria-hidden="true">
                    <use href="#i-check-circle" />
                  </svg>
                  <span className="checklist__title">Facilitator and at least one assessor</span>
                  <span className="tag tag--positive">Done</span>
                </li>
                <li className="checklist__item checklist__item--pass">
                  <svg className="icon checklist__icon" aria-hidden="true">
                    <use href="#i-check-circle" />
                  </svg>
                  <span className="checklist__title">Moderator assigned</span>
                  <span className="tag tag--positive">Done</span>
                  <span className="checklist__detail">Needed only for a moderated cohort. Anil Naidoo.</span>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
