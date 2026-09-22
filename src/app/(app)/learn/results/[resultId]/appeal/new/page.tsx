import Link from "next/link";
import "./page.css";

export const metadata = { title: "Appeal your result for Task 3" };

// Ported from docs/design/ui/prototype/learn-appeal-new.html (default state). Static shell: no data or behaviour yet.
export default function LearnAppealNewPage() {
  return (
    <>
      <div className="page page--form">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/learn">Home</Link>
              </li>
              <li>
                <Link href="/learn/results/task-3">Results</Link>
              </li>
              <li>
                <Link href="/learn/results/task-3">Task 3</Link>
              </li>
              <li aria-current="page">Appeal</li>
            </ol>
          </nav>
          <h1 className="page-header__title">Appeal your result for Task 3</h1>
          <p className="page-header__lead">
            An appeal asks us to look again at how your work was marked. Lodging an appeal does not count against you.
          </p>
        </header>
        <div className="stack stack--lg">
          {/* ============ The result being appealed, with the closing day repeated ============ */}
          <section className="stack" aria-labelledby="summary-h">
            <h2 className="u-visually-hidden" id="summary-h">
              The result you are appealing
            </h2>
            <div className="card">
              <div className="card__body cluster cluster--between">
                <div className="stack stack--sm">
                  <p className="text-overline">Task 3: Workplace records portfolio · Unit 3</p>
                  <p>
                    <span className="tag tag--caution">Not yet competent</span>{" "}
                    <span className="text-muted">
                      5 of 8 · released <time dateTime="2026-09-22T14:05:00+02:00">22 Sep 2026, 14:05</time>
                    </span>
                  </p>
                </div>
                <Link className="text-small" href="/learn/results/task-3">
                  See the result and feedback
                </Link>
              </div>
            </div>
            <p className="deadline-line">
              <svg className="icon" aria-hidden="true">
                <use href="#i-clock" />
              </svg>
              <span>
                You can lodge an appeal{" "}
                <span className="deadline-line__date">until the end of Tuesday 29 September 2026</span>.{" "}
                <span className="deadline-line__left">5 days left</span>, including weekends and public holidays.
              </span>
            </p>
          </section>
          {/* ============ Window closed on arrival: the form is replaced (FR-603) ============ */}
          {/* ============ The form: default, reasons missing, remark already used ============ */}
          <form className="form" id="appeal-form" noValidate aria-label="Lodge an appeal">
            {/* Type: default and invalid (both types offered) */}
            <fieldset className="fieldset">
              <legend className="fieldset__legend">
                What are you asking for? <span className="field__required">(required)</span>
              </legend>
              <div className="choice-group choice-group--2">
                <label className="choice">
                  <input className="choice__input" type="radio" name="appeal-type" value="script" />
                  <span className="choice__title">See my work with the marks</span>
                  <span className="choice__desc">
                    See your work next to the marks for each criterion and the assessor&apos;s feedback. This does not
                    change your mark, and it does not give you more time to ask for a re-mark.
                  </span>
                </label>{" "}
                <label className="choice choice--caution">
                  <input
                    className="choice__input"
                    type="radio"
                    name="appeal-type"
                    value="remark"
                    defaultChecked
                    aria-describedby="remark-warning"
                  />
                  <span className="choice__title">Ask for my work to be marked again</span>
                  <span className="choice__desc">
                    Someone who did not mark your work will mark it again. You can ask for a re-mark once per result.
                  </span>
                </label>
              </div>
            </fieldset>
            <div className="banner banner--caution" id="remark-warning" role="note">
              <svg className="icon banner__icon" aria-hidden="true">
                <use href="#i-scales" />
              </svg>
              <p className="banner__title">A re-mark can move your mark up or down</p>
              <div className="banner__body">
                <ul className="prose">
                  <li>
                    <strong>Your mark can go up, stay the same, or go down.</strong> Your outcome can change with it.
                  </li>
                  <li>You can ask for a re-mark once for each result.</li>
                  <li>The reviewer&apos;s decision is final. There is no further appeal.</li>
                </ul>
              </div>
            </div>
            {/* Type: remark already used (only the script option can be chosen; the reason stays visible) */}
            {/* Grounds: default (filled in) */}
            <div className="field">
              <label className="field__label" htmlFor="grounds">
                Why do you think the mark does not match the work you submitted?{" "}
                <span className="field__required">(required)</span>
              </label>
              <div className="field__help" id="grounds-help">
                <p>Point to the criteria and to the pages of your work. Write at least 50 characters. For example:</p>
                <ul className="prose">
                  <li>
                    &quot;Criterion 3.2: my access register is on pages 6 and 7, but the feedback says it is
                    missing.&quot;
                  </li>
                  <li>
                    &quot;Criterion 3.1: the comment is about a payroll index. My index is for leave records.&quot;
                  </li>
                </ul>
              </div>
              <textarea
                className="textarea"
                id="grounds"
                name="grounds"
                required
                rows={6}
                maxLength={2000}
                aria-describedby="grounds-help grounds-count"
                defaultValue={
                  "Criterion 3.2 asks for evidence that access is requested, approved and recorded. Pages 6 and 7 of my portfolio describe the access register, and page 7 has a photo of the July page with the office manager's signature. The feedback says the register is not among my evidence. I think this evidence was not counted in my mark of 2 of 4."
                }
              />
              <div className="field__footer">
                <span className="field__count" id="grounds-count">
                  334 / 2000 characters
                </span>
              </div>
            </div>
            {/* Grounds: left empty, after trying to lodge */}
            {/* Grounds: request to see the marked script */}
            <p className="text-small text-muted">
              Your appeal goes to your coordinator, Zanele Dlamini, who checks it first. The person who marked your work
              does not review your appeal.
            </p>
            <div className="form__actions u-hide-phone">
              <button type="button" className="btn btn--primary" data-modal-open="m-lodge">
                Lodge appeal
              </button>{" "}
              <Link className="btn btn--ghost" href="/learn/results/task-3">
                Cancel
              </Link>
            </div>
          </form>
          {/* ============ Confirmation: receipt, what happens next, expected turnaround (FR-604) ============ */}
        </div>
      </div>
      {/* Phones: the form's one primary action sits in the sticky bar (it replaces the bottom tabs while present). */}
      <div className="action-bar action-bar--phone-only">
        <Link className="btn btn--ghost" href="/learn/results/task-3">
          Cancel
        </Link>{" "}
        <button type="button" className="btn btn--primary" data-modal-open="m-lodge">
          Lodge appeal
        </button>{" "}
      </div>
    </>
  );
}
