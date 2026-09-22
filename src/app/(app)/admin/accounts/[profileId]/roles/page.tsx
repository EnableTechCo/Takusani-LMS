import Link from "next/link";

export const metadata = { title: "Roles and allocations" };

// Ported from docs/design/ui/prototype/admin-roles.html (default state). Static shell: no data or behaviour yet.
export default function AdminRolesPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <a href="#main" data-toast="This screen is not part of the prototype">
                  Accounts
                </a>
              </li>
              <li>
                <a href="#main" data-toast="This screen is not part of the prototype">
                  Thandiwe Nkosi
                </a>
              </li>
              <li aria-current="page">Roles and allocations</li>
            </ol>
          </nav>
          <p className="page-header__workspace">Administration</p>
          <h1 className="page-header__title">Thandiwe Nkosi: roles and allocations</h1>
          <p className="page-header__lead">
            A role says what a person may be given. It does not give them any piece of work. Separation of duties is
            checked for each item when work is allocated.
          </p>
          <div className="page-header__meta">
            <span className="tag tag--positive tag--shape-dot">Active</span>
            <span>thandiwe.nkosi@khanya.example</span>
            <span className="text-meta">STF-0042 · As at Tue 15 Sep 2026, 10:10 SAST</span>
          </div>
          <div className="page-header__actions">
            <details className="menu-wrap" data-menu="">
              <summary className="btn btn--secondary btn--icon" aria-label="More actions for this account">
                <svg className="icon" aria-hidden="true">
                  <use href="#i-dots" />
                </svg>
              </summary>
              <div className="menu menu--end">
                <button
                  type="button"
                  className="menu__item"
                  data-toast="Password reset email sent"
                  data-toast-meta="thandiwe.nkosi@khanya.example"
                >
                  Send a password reset
                </button>
                <button type="button" className="menu__item" data-modal-open="m-deactivate">
                  Deactivate account
                </button>
              </div>
            </details>
          </div>
        </header>
        {/* ===== Deactivation refused ===== */}
        {/* ===== Role assigned with advisory ===== */}
        {/* ===== Role assignments ===== */}
        <section aria-labelledby="roles-h">
          <div className="section__header">
            <h2 className="text-heading" id="roles-h">
              Role assignments
            </h2>
            <a className="btn btn--secondary btn--sm" href="#add-h">
              Add a role
            </a>
          </div>
          <div className="table-wrap">
            <table className="table table--cards">
              <caption className="u-visually-hidden">Role assignments for Thandiwe Nkosi, current first</caption>
              <thead>
                <tr>
                  <th scope="col">Role</th>
                  <th scope="col">Scope</th>
                  <th scope="col">In force from</th>
                  <th scope="col">Until</th>
                  <th scope="col">Assigned by</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="table__actions">
                    <span className="u-visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="table__primary-cell" data-label="Role">
                    <span className="table__primary">Assessor</span>
                  </td>
                  <td data-label="Scope">Cohort: 2026 Intake B</td>
                  <td data-label="From">Mon 12 Jan 2026</td>
                  <td data-label="Until">No end date</td>
                  <td data-label="Assigned by">Sibusiso Khumalo (you)</td>
                  <td data-label="Status">
                    <span className="tag tag--positive tag--shape-dot">In force</span>
                    <span className="table__secondary">13 open allocations depend on it</span>
                  </td>
                  <td className="table__actions">
                    <button type="button" className="btn btn--secondary btn--sm" data-modal-open="m-end">
                      End role
                      <span className="u-visually-hidden"> Assessor, 2026 Intake B</span>
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="table__primary-cell" data-label="Role">
                    <span className="table__primary">Moderator</span>
                  </td>
                  <td data-label="Scope">Cohort: 2026 Intake C</td>
                  <td data-label="From">Mon 2 Mar 2026</td>
                  <td data-label="Until">No end date</td>
                  <td data-label="Assigned by">Zanele Dlamini</td>
                  <td data-label="Status">
                    <span className="tag tag--positive tag--shape-dot">In force</span>
                    <span className="table__secondary">3 open allocations depend on it</span>
                  </td>
                  <td className="table__actions">
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      data-toast="Not part of this prototype. It would be refused in the same way"
                    >
                      End role
                      <span className="u-visually-hidden"> Moderator, 2026 Intake C</span>
                    </button>
                  </td>
                </tr>
                <tr>
                  <td className="table__primary-cell" data-label="Role">
                    <span className="table__primary">Assessor</span>
                  </td>
                  <td data-label="Scope">Cohort: 2025 Intake A</td>
                  <td data-label="From">Mon 13 Jan 2025</td>
                  <td data-label="Until">End of Fri 28 Nov 2025</td>
                  <td data-label="Assigned by">Sibusiso Khumalo (you)</td>
                  <td data-label="Status">
                    <span className="tag tag--shape-square">Ended</span>
                  </td>
                  <td className="table__actions">
                    <span className="text-small text-muted">Kept on record</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <div className="page-layout section">
          <div className="page-layout__main stack--lg stack">
            {/* ===== Open allocations ===== */}
            <section aria-labelledby="alloc-h">
              <div className="section__header">
                <h2 className="text-heading" id="alloc-h" tabIndex={-1}>
                  Open allocations
                </h2>
                <span className="text-small text-muted">
                  Work that is with her now. A role cannot be ended while work depends on it.
                </span>
              </div>
              <div className="table-wrap">
                <table className="table table--cards">
                  <caption className="u-visually-hidden">Work currently allocated to Thandiwe Nkosi</caption>
                  <thead>
                    <tr>
                      <th scope="col">Work</th>
                      <th scope="col">Depends on the role</th>
                      <th scope="col" className="table__num">
                        Items
                      </th>
                      <th scope="col">Next date</th>
                      <th scope="col" className="table__actions">
                        <span className="u-visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="table__primary-cell" data-label="Work">
                        <span className="table__primary">Items to mark</span>
                        <span className="table__secondary">2026 Intake B · Task 4 (9), Task 3 (3)</span>
                      </td>
                      <td data-label="Role">Assessor, 2026 Intake B</td>
                      <td className="table__num" data-label="Items">
                        12
                      </td>
                      <td data-label="Next date">Oldest submitted Fri 4 Sep 2026</td>
                      <td className="table__actions">
                        <button type="button" className="btn btn--secondary btn--sm" data-modal-open="m-reallocate">
                          Reallocate
                          <span className="u-visually-hidden"> 12 items to mark</span>
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Work">
                        <span className="table__primary">Item returned for re-marking</span>
                        <span className="table__secondary">
                          Lerato Mokoena · Task 3 · cycle &quot;Term 3 tasks&quot;
                        </span>
                      </td>
                      <td data-label="Role">Assessor, 2026 Intake B</td>
                      <td className="table__num" data-label="Items">
                        1
                      </td>
                      <td data-label="Next date">
                        <span className="deadline deadline--soon">
                          <svg className="icon icon--sm" aria-hidden="true">
                            <use href="#i-clock" />
                          </svg>
                          Due Thu 17 Sep 2026 · in 2 days
                        </span>
                      </td>
                      <td className="table__actions">
                        <button type="button" className="btn btn--secondary btn--sm" data-modal-open="m-reallocate">
                          Reallocate
                          <span className="u-visually-hidden"> the returned item</span>
                        </button>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Work">
                        <span className="table__primary">Sample items to review</span>
                        <span className="table__secondary">2026 Intake C</span>
                      </td>
                      <td data-label="Role">Moderator, 2026 Intake C</td>
                      <td className="table__num" data-label="Items">
                        3
                      </td>
                      <td data-label="Next date">No date set</td>
                      <td className="table__actions">
                        <Link className="btn btn--secondary btn--sm" href="/moderate/cycles/cycle-1/items/item-7">
                          Open
                          <span className="u-visually-hidden"> the 3 sample items</span>
                        </Link>
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Work">
                        <span className="table__primary">Appeal reviews</span>
                      </td>
                      <td data-label="Role">Given for one appeal at a time</td>
                      <td className="table__num" data-label="Items">
                        0
                      </td>
                      <td data-label="Next date">None</td>
                      <td className="table__actions">
                        <span className="text-small text-muted">Nothing to reallocate</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
            {/* ===== Add a role ===== */}
            <section aria-labelledby="add-h">
              <div className="section__header">
                <h2 className="text-heading" id="add-h" tabIndex={-1}>
                  Add a role
                </h2>
              </div>
              <form className="form card">
                <div className="card__body form">
                  <div className="form__row form__row--2">
                    <div className="field">
                      <label className="field__label" htmlFor="r-role">
                        Role
                      </label>
                      <span className="select">
                        <select id="r-role">
                          <option>Moderator</option>
                          <option>Assessor</option>
                          <option>Facilitator</option>
                          <option>Coordinator</option>
                          <option>System Administrator</option>
                        </select>
                      </span>
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="r-type">
                        Scope type
                      </label>
                      <span className="select">
                        <select id="r-type">
                          <option>Cohort</option>
                          <option>Programme</option>
                          <option>Unit</option>
                          <option>Global</option>
                        </select>
                      </span>
                    </div>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="r-scope">
                      Scope
                    </label>
                    <p className="field__help" id="r-scope-help">
                      Where the role applies. She holds Assessor in this cohort already.
                    </p>
                    <span className="select">
                      <select id="r-scope" aria-describedby="r-scope-help r-advice">
                        <option>2026 Intake B · Certificate in Business Administration · Moderated</option>
                        <option>2026 Intake C · Certificate in Business Administration · Not moderated</option>
                      </select>
                    </span>
                  </div>
                  <div className="banner banner--info banner--compact" role="status" id="r-advice">
                    <svg className="icon banner__icon" aria-hidden="true">
                      <use href="#i-info" />
                    </svg>
                    <p className="banner__body">
                      Thandiwe Nkosi also assesses in 2026 Intake B. You can still assign this role. She will never be
                      given work she assessed, and after you assign it you will see exactly which results that covers.
                    </p>
                  </div>
                  <div className="form__row form__row--2">
                    <div className="field">
                      <label className="field__label" htmlFor="r-from">
                        In force from
                      </label>
                      <input className="input" id="r-from" type="date" defaultValue="2026-09-21" />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="r-to">
                        Until the end of <span className="field__optional">(optional)</span>
                      </label>
                      <input className="input" id="r-to" type="date" />
                    </div>
                  </div>
                  <div className="form__actions">
                    <button type="button" className="btn btn--primary">
                      Assign role
                    </button>
                  </div>
                </div>
              </form>
            </section>
          </div>
          {/* ===== Change history ===== */}
          <aside className="page-layout__aside" aria-labelledby="hist-h">
            <h2 className="text-subheading u-mb-4" id="hist-h">
              Change history
            </h2>
            <ol
              className="log log--boxed"
              aria-label="Changes to this person's roles and account, newest first. Times in SAST."
            >
              <li className="log__item">
                <time className="log__time" dateTime="2026-03-02T08:55:00+02:00">
                  2 Mar 2026, 08:55
                </time>
                <div className="log__event">
                  <span className="log__actor">Zanele Dlamini</span> assigned Moderator, Cohort: 2026 Intake C, from 2
                  Mar 2026. Previous value: none.
                </div>
              </li>
              <li className="log__item">
                <time className="log__time" dateTime="2026-01-12T09:31:00+02:00">
                  12 Jan 2026, 09:31
                </time>
                <div className="log__event">
                  <span className="log__actor">Sibusiso Khumalo</span> assigned Assessor, Cohort: 2026 Intake B, from 12
                  Jan 2026. Previous value: none.
                </div>
              </li>
              <li className="log__item">
                <time className="log__time" dateTime="2025-11-28T16:02:00+02:00">
                  28 Nov 2025, 16:02
                </time>
                <div className="log__event">
                  <span className="log__actor">Sibusiso Khumalo</span> ended Assessor, Cohort: 2025 Intake A. Previous
                  value: no end date. New value: end of 28 Nov 2025. No open allocations.
                </div>
              </li>
              <li className="log__item">
                <time className="log__time" dateTime="2025-01-13T08:40:00+02:00">
                  13 Jan 2025, 08:40
                </time>
                <div className="log__event">
                  <span className="log__actor">Sibusiso Khumalo</span> created the account and assigned Assessor,
                  Cohort: 2025 Intake A.
                </div>
              </li>
            </ol>
            <p className="text-small u-mt-4">
              <a href="#main" data-toast="This screen is not part of the prototype">
                See these entries in the audit log
              </a>
            </p>
          </aside>
        </div>
      </div>
    </>
  );
}
