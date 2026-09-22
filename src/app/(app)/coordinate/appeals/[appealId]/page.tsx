import Link from "next/link";
import "./page.css";

export const metadata = { title: "Appeal detail" };

// Ported from docs/design/ui/prototype/coordinate-appeal-detail.html (default state). Static shell: no data or behaviour yet.
export default function CoordinateAppealDetailPage() {
  return (
    <>
      <div className="page">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/coordinate/appeals">Appeals</Link>
              </li>
              <li aria-current="page">
                <span>APL-2026-0031</span>
              </li>
            </ol>
          </nav>
          <p className="page-header__workspace">Coordinating</p>
          <h1 className="page-header__title">
            Appeal <span>APL-2026-0031</span>
          </h1>
          <div className="page-header__meta">
            <span className="tag tag--info">New. Needs admissibility check</span>{" "}
            <span>
              Lerato Mokoena · Task 3 · 2026 Intake B <span className="tag tag--plain">Moderated</span>
            </span>{" "}
            <span>Remark request</span>
          </div>
        </header>
        <div className="page-layout">
          <div className="page-layout__main stack">
            {/* turnaround */}
            <p className="deadline-line">
              <svg className="icon" aria-hidden="true">
                <use href="#i-clock" />
              </svg>
              <span>
                Lerato was promised a reply within 5 working days:{" "}
                <span className="deadline-line__date">by the end of Thursday 1 October 2026</span>.{" "}
                <span className="deadline-line__left">5 working days left</span>. Heritage Day, Thu 24 Sep, is not a
                working day.
              </span>
            </p>
            {/* ================= Lerato: grounds and result ================= */}
            <section className="card" aria-labelledby="grounds-h">
              <div className="card__header">
                <h2 className="card__title" id="grounds-h">
                  What Lerato asked for
                </h2>
                <span className="text-meta">Lodged Thu 24 Sep 2026, 08:14 SAST</span>
              </div>
              <div className="card__body stack">
                <dl className="dl dl--inline">
                  <div className="dl__row">
                    <dt>Request</dt>
                    <dd>A remark. She ticked &quot;I understand my mark can go down as well as up.&quot;</dd>
                  </div>
                  <div className="dl__row">
                    <dt>Inside the window?</dt>
                    <dd>
                      Yes. Released Tue 22 Sep 2026, 14:05 SAST. The window runs to the end of Tue 29 Sep 2026. Lodged
                      on day 2 of 7.
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Earlier remark on this result?</dt>
                    <dd>None. Only one remark is allowed for each result.</dd>
                  </div>
                </dl>
                <div>
                  <p className="text-subheading">Her grounds, as she wrote them</p>
                  <div className="prose u-mt-2">
                    <blockquote>
                      <p>
                        Criterion 3.2 was marked as partly met because the access register was missing. The register for
                        July and August is in my version 2 upload as the third file, Access-register.pdf, and page 6 of
                        my portfolio refers to it. I think the third file was not opened. I am asking for my work to be
                        marked again with all three files.
                      </p>
                    </blockquote>
                  </div>
                </div>
              </div>
            </section>
            <section className="card" aria-labelledby="result-h">
              <div className="card__header">
                <h2 className="card__title" id="result-h">
                  The result being appealed
                </h2>
                <Link className="btn btn--secondary btn--sm" href="/assess/instances/instance-1">
                  Open the marked work
                </Link>
              </div>
              <div className="card__body stack">
                <dl className="dl dl--inline">
                  <div className="dl__row">
                    <dt>Item</dt>
                    <dd>
                      Task 3: Workplace records portfolio · Unit 3 (8 credits) · version 2, submitted Fri 4 Sep 2026,
                      17:42, Late
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Moderation</dt>
                    <dd>
                      Sampled as item 7 of &quot;Term 3 tasks&quot;. Anil Naidoo returned it on 15 Sep 2026 and agreed
                      with the re-mark on 18 Sep 2026.{" "}
                      <Link href="/moderate/cycles/cycle-1/items/item-7">View the moderation record</Link>
                    </dd>
                  </div>
                  <div className="dl__row">
                    <dt>Decided and released</dt>
                    <dd>
                      Decided 16 Sep 2026. Released 22 Sep 2026, 14:05 SAST, when &quot;Term 3 tasks&quot; was signed
                      off.
                    </dd>
                  </div>
                </dl>
                <ol className="history-list" aria-label="Decisions on this result, newest first">
                  <li className="history-list__item is-current">
                    <span className="history-list__badge">2</span>
                    <span className="history-list__title">Re-mark: Not yet competent · 5 of 8</span>
                    <span className="history-list__meta">
                      16 Sep 2026, 10:05 · assessor Thandiwe Nkosi · after moderation returned it
                    </span>
                    <span className="history-list__actions">
                      <span className="tag tag--plain">Current</span>
                    </span>
                  </li>
                  <li className="history-list__item">
                    <span className="history-list__badge">1</span>
                    <span className="history-list__title">Not yet competent · 5 of 8 (original)</span>
                    <span className="history-list__meta">
                      10 Sep 2026, 11:20 · assessor Thandiwe Nkosi · kept on record
                    </span>
                  </li>
                </ol>
              </div>
            </section>
            {/* ================= lodged: admissibility ================= */}
            <section className="card" aria-labelledby="adm-h">
              <div className="card__header">
                <h2 className="card__title" id="adm-h">
                  Admissibility decision
                </h2>
              </div>
              <div className="card__body">
                <form className="form" id="adm-form" noValidate>
                  <div className="error-summary" role="alert" tabIndex={-1} id="adm-errors" hidden>
                    <p className="error-summary__title">There is 1 thing to fix</p>
                    <ul>
                      <li>
                        <a href="#adm-reason" id="adm-error-link">
                          Enter the reason this appeal cannot be accepted
                        </a>
                      </li>
                    </ul>
                  </div>
                  <fieldset className="fieldset" id="adm-choice">
                    <legend className="fieldset__legend">
                      Can this appeal be accepted? <span className="field__required">(required)</span>
                    </legend>
                    <div className="choice-group choice-group--2">
                      <label className="choice">
                        <input className="choice__input" type="radio" name="adm" value="admit" defaultChecked />
                        <span className="choice__title">Admit</span>
                        <span className="choice__desc">
                          Lerato is told today that her appeal was accepted. You then choose a reviewer who took no
                          assessment decision on this work.
                        </span>
                      </label>{" "}
                      <label className="choice choice--caution">
                        <input className="choice__input" type="radio" name="adm" value="inadmissible" />
                        <span className="choice__title">Record as inadmissible</span>
                        <span className="choice__desc">
                          The appeal ends here. Lerato is told, with your reason, in the LMS and by email. This cannot
                          be reversed.
                        </span>
                      </label>
                    </div>
                  </fieldset>
                  <div className="field">
                    <label className="field__label" htmlFor="adm-reason">
                      Reason, if inadmissible <span className="field__required">(required when inadmissible)</span>
                    </label>
                    <p className="field__help" id="adm-reason-help">
                      Lerato reads this word for word. Say which rule the appeal does not meet. Do not comment on her
                      work.
                    </p>
                    <textarea className="textarea" id="adm-reason" rows={3} aria-describedby="adm-reason-help" />
                    <p className="field__error" id="adm-reason-err" hidden>
                      <svg className="icon icon--sm" aria-hidden="true">
                        <use href="#i-alert-circle" />
                      </svg>
                      Enter a reason. An appeal cannot be recorded as inadmissible without one, because the learner must
                      be told why.
                    </p>
                  </div>
                  <div>
                    <p className="text-subheading u-mb-4">What Lerato will be sent</p>
                    <div className="notice-preview" aria-live="polite">
                      <p>
                        <strong id="adm-preview-title">Your appeal APL-2026-0031 was accepted</strong>
                      </p>
                      <p id="adm-preview-body">
                        A reviewer who did not mark your work will mark Task 3 again. The mark can stay the same, go up
                        or go down. That decision is final. We expect to reply by the end of Thursday 1 October 2026.
                      </p>
                      <p className="text-meta">
                        In the LMS and by email to lerato.mokoena@example.org · cannot be switched off
                      </p>
                    </div>
                  </div>
                  <div className="form__actions">
                    <button type="submit" className="btn btn--primary" id="adm-submit">
                      Record decision
                    </button>
                    <Link className="btn btn--ghost" href="/coordinate/appeals">
                      Back to appeals
                    </Link>
                  </div>
                </form>
              </div>
            </section>
            {/* ================= admitted: choose a reviewer (Lerato) ================= */}
            {/* ================= allocated / under review ================= */}
            {/* ================= concluded ================= */}
            {/* ================= Other appeal (Thabo Molefe): refused and tier 3 ================= */}
          </div>
          {/* ================= Aside ================= */}
          <aside className="page-layout__aside stack" aria-label="Timeline and records">
            <section aria-labelledby="tl-h">
              <h2 className="text-subheading u-mb-4" id="tl-h">
                Timeline
              </h2>
              <ol className="stepper" id="appeal-steps" aria-label="Progress of appeal APL-2026-0031">
                <li className="stepper__step">
                  <span className="stepper__label">
                    Lodged
                    <span className="u-visually-hidden" data-step-text="" />
                  </span>
                  <span className="stepper__meta">24 Sep 2026, 08:14</span>
                  <span className="stepper__body">Remark of Task 3. Receipt sent to Lerato.</span>
                </li>
                <li className="stepper__step">
                  <span className="stepper__label">
                    Admissibility check
                    <span className="u-visually-hidden" data-step-text="" />
                  </span>
                  <span className="stepper__body">Waiting for you.</span>
                </li>
                <li className="stepper__step">
                  <span className="stepper__label">
                    Reviewer allocated
                    <span className="u-visually-hidden" data-step-text="" />
                  </span>
                </li>
                <li className="stepper__step">
                  <span className="stepper__label">
                    Under review
                    <span className="u-visually-hidden" data-step-text="" />
                  </span>
                </li>
                <li className="stepper__step">
                  <span className="stepper__label">
                    Concluded
                    <span className="u-visually-hidden" data-step-text="" />
                  </span>
                  <span className="stepper__body">Upheld, amended upward or amended downward. Final.</span>
                </li>
              </ol>
            </section>
            <details className="delivery-evidence" open>
              <summary>How Lerato was told of the result</summary>
              <ul className="delivery-evidence__list">
                <li className="delivery-evidence__row">
                  <span className="delivery-evidence__channel">In the LMS</span>
                  <time className="delivery-evidence__time" dateTime="2026-09-22T14:05:00+02:00">
                    22 Sep 2026, 14:05
                  </time>
                </li>
                <li className="delivery-evidence__row">
                  <span className="delivery-evidence__channel">Email: delivered</span>
                  <time className="delivery-evidence__time" dateTime="2026-09-22T14:06:00+02:00">
                    22 Sep 2026, 14:06
                  </time>
                </li>
                <li className="delivery-evidence__row">
                  <span className="delivery-evidence__channel">First opened by her</span>
                  <time className="delivery-evidence__time" dateTime="2026-09-22T18:31:00+02:00">
                    22 Sep 2026, 18:31
                  </time>
                </li>
              </ul>
            </details>
            <section aria-labelledby="log-h">
              <h2 className="text-subheading u-mb-4" id="log-h">
                Appeal record
              </h2>
              <ol className="log log--boxed" aria-label="Appeal record, oldest first. Times in SAST.">
                <li className="log__item">
                  <time className="log__time" dateTime="2026-09-24T08:14:00+02:00">
                    24 Sep 2026, 08:14
                  </time>
                  <div className="log__event">
                    <span className="log__actor">Lerato Mokoena</span> lodged a remark request. Window snapshot: closes
                    at the end of 29 Sep 2026.
                  </div>
                </li>
              </ol>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}
