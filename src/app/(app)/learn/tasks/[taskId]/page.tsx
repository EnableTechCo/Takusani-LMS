import Link from "next/link";

export const metadata = { title: "Task 3: Workplace records portfolio" };

// Ported from docs/design/ui/prototype/learn-task.html (default state). Static shell: no data or behaviour yet.
export default function LearnTaskPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/learn">Home</Link>
              </li>
              <li>
                <Link href="/learn/tasks/task-3">Tasks</Link>
              </li>
              <li aria-current="page">Task 3</li>
            </ol>
          </nav>
          <h1 className="page-header__title">Task 3: Workplace records portfolio</h1>
          <div className="page-header__meta">
            <span className="tag">Not started</span> <span>Unit 3: Workplace records · 8 credits</span>{" "}
            <span>Set by Pieter van Wyk</span>
          </div>
        </header>
        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            {/* ============ Due date line and the state of this task, always first ============ */}
            <div className="stack">
              <p className="deadline-line">
                <svg className="icon" aria-hidden="true">
                  <use href="#i-clock" />
                </svg>
                <span>
                  Due <span className="deadline-line__date">Friday 4 September 2026 at 17:00</span> (SAST),{" "}
                  <span className="deadline-line__left">in 8 days</span>. Work submitted after 17:00 is marked as late.
                </span>
              </p>
            </div>
            {/* ============ Receipt (after submitting; also reachable later from the version history) ============ */}
            {/* ============ Brief ============ */}
            <section aria-labelledby="brief-h">
              <h2 className="text-heading u-mb-4" id="brief-h">
                What to do
              </h2>
              <div className="prose">
                <p>
                  Choose one set of records that your workplace, or the practice office at the training centre, keeps.
                  Good examples are leave records, payroll records or supplier invoices. Build a short portfolio that
                  shows how those records are filed, how long they are kept, and who may see them.
                </p>
                <ol>
                  <li>
                    Draw up a filing index for the records, and test it: another person must be able to find five
                    records from your index without your help.
                  </li>
                  <li>Write a retention schedule that says how long each type of record is kept, and why.</li>
                  <li>
                    Describe how access to confidential records is controlled. Include evidence that requests are
                    written down and approved.
                  </li>
                </ol>
                <p>
                  Remove or cover personal details such as identity numbers and bank account numbers before you upload
                  anything.
                </p>
              </div>
            </section>
            {/* ============ Criteria (read-only) ============ */}
            <section aria-labelledby="criteria-h">
              <h2 className="text-heading u-mb-4" id="criteria-h">
                How your work is assessed
              </h2>
              <div className="table-wrap">
                <table className="table table--cards">
                  <caption className="u-visually-hidden">
                    Assessment criteria for Task 3. Each criterion is marked out of 4.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Criterion</th>
                      <th scope="col">What your assessor looks for</th>
                      <th scope="col" className="table__num">
                        Marks
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="table__primary-cell" data-label="Criterion">
                        <span className="table__primary">Maintains a filing index that others can use</span>
                        <span className="table__secondary mono">AC 3.1</span>
                      </td>
                      <td data-label="Looks for">Records in the sample can be found from the index without help.</td>
                      <td className="table__num" data-label="Marks">
                        4
                      </td>
                    </tr>
                    <tr>
                      <td className="table__primary-cell" data-label="Criterion">
                        <span className="table__primary">Controls access to confidential records</span>
                        <span className="table__secondary mono">AC 3.2</span>
                      </td>
                      <td data-label="Looks for">Evidence that access is requested, approved and recorded.</td>
                      <td className="table__num" data-label="Marks">
                        4
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-small text-muted u-mt-2">
                The outcome is Competent or Not yet competent. If the outcome is Not yet competent, your assessor tells
                you what to add, and you get time to resubmit.
              </p>
            </section>
            {/* ============ Evidence requirements and upload ============ */}
            <section aria-labelledby="submit-h">
              <div className="section__header">
                <h2 className="text-heading" id="submit-h">
                  <span>Submit your work</span>
                </h2>
              </div>
              <div className="stack stack--lg">
                {/* Requirement 1 */}
                <div className="upload">
                  <div className="upload__drop">
                    <svg className="icon icon--xl" aria-hidden="true">
                      <use href="#i-upload" />
                    </svg>
                    <p className="upload__title">
                      <span>Add evidence for requirement 1: portfolio document</span>
                    </p>
                    <p>One PDF or DOCX file, up to 25 MB. This requirement must be met before you can submit.</p>
                    <input className="upload__input" type="file" id="up-req1" accept=".pdf,.docx" />{" "}
                    <label className="btn btn--secondary" htmlFor="up-req1">
                      Choose a file
                    </label>
                  </div>
                </div>
                {/* Requirement 2 */}
                <div className="upload">
                  <div className="upload__drop">
                    <svg className="icon icon--xl" aria-hidden="true">
                      <use href="#i-upload" />
                    </svg>
                    <p className="upload__title">
                      <span>Add evidence for requirement 2: supporting records</span>
                    </p>
                    <p>
                      Your filing index, your retention schedule, and proof of how access is controlled. PDF, DOCX,
                      XLSX, JPG or PNG. Up to 25 MB each. If your connection drops, the upload carries on from where it
                      stopped.
                    </p>
                    <input
                      className="upload__input"
                      type="file"
                      id="up-req2"
                      multiple
                      accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
                    />{" "}
                    <label className="btn btn--secondary" htmlFor="up-req2">
                      Choose files
                    </label>
                  </div>
                </div>
                {/* Review and submit */}
                <div className="card card--sunken">
                  <div className="card__body stack">
                    <p className="text-subheading">This will be version 1.</p>
                    <p className="text-small text-muted">
                      You can submit a new version at any time before your work is assessed. Every version you submit is
                      kept.
                    </p>
                    <div className="cluster">
                      <button type="button" className="btn btn--primary" disabled aria-describedby="submit-blocked">
                        Submit version 1
                      </button>{" "}
                      <p className="blocked-reason" id="submit-blocked">
                        <svg className="icon icon--sm" aria-hidden="true">
                          <use href="#i-info" />
                        </svg>
                        <span>You cannot submit yet: add your portfolio document for requirement 1.</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
          {/* ============ Aside: facts and version history ============ */}
          <aside className="page-layout__aside stack" aria-label="Task facts and version history">
            <div className="card">
              <div className="card__header">
                <h2 className="card__title">About this task</h2>
              </div>
              <div className="card__body">
                <dl className="dl">
                  <div className="dl__row">
                    <dt>Due</dt>
                    <dd>
                      <time dateTime="2026-09-04T17:00:00+02:00">Friday 4 September 2026 at 17:00 (SAST)</time>
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Counts towards</dt>
                    <dd>Unit 3: Workplace records, 8 credits</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Evidence needed</dt>
                    <dd>
                      1. Portfolio document (PDF or DOCX). 2. Supporting records (PDF, DOCX, XLSX, JPG or PNG). Up to 25
                      MB for each file. Videos cannot be uploaded.
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>If you submit late</dt>
                    <dd>You can still submit. Your work is marked as late and is assessed in the normal way.</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Questions about this task</dt>
                    <dd>
                      <Link href="/">Ask Pieter van Wyk</Link>
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
            <section aria-labelledby="versions-h">
              <h2 className="text-subheading u-mb-4" id="versions-h">
                Version history
              </h2>
              <p className="text-small text-muted">
                You have not submitted anything yet. Each version you submit will be listed here with its receipt, and
                none is ever removed.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
