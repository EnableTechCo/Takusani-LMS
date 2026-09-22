import Link from "next/link";

export const metadata = { title: "Configuration" };

// Ported from docs/design/ui/prototype/admin-configuration.html (default state). Static shell: no data or behaviour yet.
export default function AdminConfigurationPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <p className="page-header__workspace">Administration</p>
          <h1 className="page-header__title">Configuration</h1>
          <p className="page-header__lead">
            Settings that apply to the whole institution. A setting is never edited: a change is recorded as a new
            version with the day it takes effect, and every earlier version stays on record with who changed it.
          </p>
          <div className="page-header__meta">
            <span className="tag">No changes scheduled</span> <span>5 groups of settings</span>
            <span className="text-meta">As at Mon 21 Sep 2026, 11:30 SAST</span>
          </div>
        </header>
        <div className="banner banner--info u-mb-6" role="note">
          <svg className="icon banner__icon" aria-hidden="true">
            <use href="#i-info" />
          </svg>
          <p className="banner__title">A change never reaches back</p>
          <p className="banner__body">
            A moderation cycle keeps the sampling rule it was frozen with. An exam attempt keeps the integrity settings
            it started with. A released result keeps the appeal closing day it was given. Credits already awarded keep
            their value.
          </p>
        </div>
        <div className="stack stack--lg">
          <section aria-labelledby="g-mod">
            <div className="section__header">
              <h2 className="text-heading" id="g-mod">
                Moderation sampling
              </h2>
            </div>
            <div className="table-wrap">
              <table className="table table--cards">
                <caption className="u-visually-hidden">Moderation sampling settings</caption>
                <thead>
                  <tr>
                    <th scope="col">Setting</th>
                    <th scope="col">Current value</th>
                    <th scope="col">In force from</th>
                    <th scope="col">Last changed by</th>
                    <th scope="col" className="table__actions">
                      <span className="u-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Sampling rule</span>
                      <span className="table__secondary mono">moderation.sampling.rule</span>
                    </td>
                    <td data-label="Value">rule-v4: by mark band, largest remainder</td>
                    <td data-label="In force from">Wed 1 Jul 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Sampling rule</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Sampling percentage</span>
                      <span className="table__secondary mono">moderation.sampling.percentage</span>
                    </td>
                    <td data-label="Value">
                      <span>15% </span>
                    </td>
                    <td data-label="In force from">Wed 1 Jul 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <Link className="btn btn--secondary btn--sm" href="/admin/configuration/sampling-percentage">
                        Open
                        <span className="u-visually-hidden"> Sampling percentage</span>
                      </Link>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Mandatory inclusions</span>
                      <span className="table__secondary mono">moderation.sampling.mandatory</span>
                    </td>
                    <td data-label="Value">
                      Every Not yet competent decision. Every decision by a first-time assessor.
                    </td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Mandatory inclusions</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Maximum hold before an alert</span>
                      <span className="table__secondary mono">moderation.hold.max_days</span>
                    </td>
                    <td data-label="Value">21 days</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Maximum hold</span>
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="g-exam">
            <div className="section__header">
              <h2 className="text-heading" id="g-exam">
                Exam integrity
              </h2>
            </div>
            <div className="table-wrap">
              <table className="table table--cards">
                <caption className="u-visually-hidden">Exam integrity settings</caption>
                <thead>
                  <tr>
                    <th scope="col">Setting</th>
                    <th scope="col">Current value</th>
                    <th scope="col">In force from</th>
                    <th scope="col">Last changed by</th>
                    <th scope="col" className="table__actions">
                      <span className="u-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Events before an attempt is marked for review</span>
                      <span className="table__secondary mono">exam.integrity.threshold</span>
                    </td>
                    <td data-label="Value">3 events. Never shown to learners.</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Integrity threshold</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Grace before leaving the window is recorded</span>
                      <span className="table__secondary mono">exam.integrity.return_grace_s</span>
                    </td>
                    <td data-label="Value">10 seconds</td>
                    <td data-label="In force from">Mon 4 May 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Return grace</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Grace for answers that arrive after time is up</span>
                      <span className="table__secondary mono">exam.accept_grace_s</span>
                    </td>
                    <td data-label="Value">30 seconds</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Acceptance grace</span>
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="g-appeal">
            <div className="section__header">
              <h2 className="text-heading" id="g-appeal">
                Appeals and late work
              </h2>
            </div>
            <div className="table-wrap">
              <table className="table table--cards">
                <caption className="u-visually-hidden">Appeal window and late submission settings</caption>
                <thead>
                  <tr>
                    <th scope="col">Setting</th>
                    <th scope="col">Current value</th>
                    <th scope="col">In force from</th>
                    <th scope="col">Last changed by</th>
                    <th scope="col" className="table__actions">
                      <span className="u-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Appeal window</span>
                      <span className="table__secondary mono">appeal.window_days</span>
                    </td>
                    <td data-label="Value">7 calendar days from release, to the end of the last day</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Appeal window</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Late submission policy</span>
                      <span className="table__secondary mono">submission.late_policy</span>
                    </td>
                    <td data-label="Value">
                      Accept late work and mark it Late. No change to the mark. The assessor sees how late it was.
                    </td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Late submission policy</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Resubmission period</span>
                      <span className="table__secondary mono">submission.resubmit_days</span>
                    </td>
                    <td data-label="Value">14 days from release, to the end of the last day</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Resubmission period</span>
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="g-credit">
            <div className="section__header">
              <h2 className="text-heading" id="g-credit">
                Credit values per unit
              </h2>
              <span className="text-small text-muted">
                Certificate in Business Administration, NQF Level 4 · 140 credits
              </span>
            </div>
            <div className="table-wrap">
              <table className="table table--cards">
                <caption className="u-visually-hidden">Credit values per unit</caption>
                <thead>
                  <tr>
                    <th scope="col">Setting</th>
                    <th scope="col">Current value</th>
                    <th scope="col">In force from</th>
                    <th scope="col">Last changed by</th>
                    <th scope="col" className="table__actions">
                      <span className="u-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Unit 3: Workplace records</span>
                      <span className="table__secondary mono">credits.unit.3</span>
                    </td>
                    <td data-label="Value">8 credits</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Unit 3 credits</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Unit 4: Business communication</span>
                      <span className="table__secondary mono">credits.unit.4</span>
                    </td>
                    <td data-label="Value">10 credits</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Unit 4 credits</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">12 more units</span>
                    </td>
                    <td data-label="Value">122 credits in all</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        See all units
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section aria-labelledby="g-file">
            <div className="section__header">
              <h2 className="text-heading" id="g-file">
                File upload limits
              </h2>
            </div>
            <div className="table-wrap">
              <table className="table table--cards">
                <caption className="u-visually-hidden">File upload limits</caption>
                <thead>
                  <tr>
                    <th scope="col">Setting</th>
                    <th scope="col">Current value</th>
                    <th scope="col">In force from</th>
                    <th scope="col">Last changed by</th>
                    <th scope="col" className="table__actions">
                      <span className="u-visually-hidden">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Accepted file types</span>
                      <span className="table__secondary mono">upload.types</span>
                    </td>
                    <td data-label="Value">PDF, DOCX, XLSX, JPG, PNG</td>
                    <td data-label="In force from">Mon 12 Jan 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Accepted file types</span>
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td className="table__primary-cell" data-label="Setting">
                      <span className="table__primary">Largest file</span>
                      <span className="table__secondary mono">upload.max_mb</span>
                    </td>
                    <td data-label="Value">25 MB each</td>
                    <td data-label="In force from">Mon 2 Mar 2026</td>
                    <td data-label="Changed by">Sibusiso Khumalo (you)</td>
                    <td className="table__actions">
                      <a
                        className="btn btn--secondary btn--sm"
                        href="#main"
                        data-toast="This screen is not part of the prototype"
                      >
                        Open
                        <span className="u-visually-hidden"> Largest file</span>
                      </a>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
