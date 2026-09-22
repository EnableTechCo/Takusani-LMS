import Link from "next/link";
import "./page.css";

export const metadata = { title: "Unit 5 summative exam" };

// Ported from docs/design/ui/prototype/exam-attempt.html (default state). Static shell: no data or behaviour yet.
export default function ExamAttemptPage() {
  return (
    <>
      {/* ExamShell contains NO navigation components: no side navigation, tabs, bell, search, account menu or brand link (FR-901). */}
      <div className="xm-app" id="xm-app">
        {/* Skip links come first in tab order: to the question, to the question list, to the action bar. */}
        <a className="skip-link" href="#question" data-skip="question">
          Skip to the question
        </a>{" "}
        <a className="skip-link" href="#navigator" data-skip="navigator">
          Skip to the list of questions
        </a>{" "}
        <a className="skip-link" href="#actions" data-skip="actions">
          Skip to Previous and Next
        </a>
        {/* One polite announcer for everything that is said once: low-time thresholds, marking a question, recovery messages. The ticking timer and the ten-second "Saved" tick are never announced (UX architecture 8.3, 8.4, 11.3). */}
        <p className="u-visually-hidden" role="status" aria-live="polite" id="xm-announce" />
        <div className="exam-shell" id="exam">
          <header className="exam-shell__bar exam-bar">
            <span className="exam-bar__title">Unit 5 summative exam</span>{" "}
            <span className="exam-bar__position" id="xm-position">
              Question 3 of 6
            </span>
            {/* Persistence status. role="status" with aria-live="off": routine changes (Saved on this device, Saved 10:42) are visible but silent. Moving into or out of a problem state is announced by the offline banner (alert), the "Back online" banner (status) or the announcer above, so nothing is said twice. */}
            <span role="status" aria-live="off" id="xm-status">
              <span className="status-line status-line--local" data-status="local" hidden>
                <svg className="icon" aria-hidden="true">
                  <use href="#i-device" />
                </svg>
                Saved on this device
              </span>{" "}
              <span className="status-line status-line--saved" data-status="saved">
                <svg className="icon" aria-hidden="true">
                  <use href="#i-cloud-check" />
                </svg>
                Saved{" "}
                <span className="status-line__time" id="xm-saved-time">
                  10:42
                </span>
              </span>{" "}
              <span className="status-line status-line--problem" data-status="problem" hidden>
                <svg className="icon" aria-hidden="true">
                  <use href="#i-offline" />
                </svg>
                Not saved to the server. Your answers are being kept on this device.
              </span>{" "}
              <span className="status-line" data-status="sending" hidden>
                <span className="spinner" aria-hidden="true" />
                Saving your final answers
              </span>{" "}
              <span className="status-line status-line--locked" data-status="locked" hidden>
                <svg className="icon" aria-hidden="true">
                  <use href="#i-lock" />
                </svg>
                Submitted and locked
              </span>
            </span>
            <div className="timer" id="xm-timer" role="timer" aria-label="Time left: 1 hour 12 minutes">
              {" "}
              <span className="timer__label" id="xm-timer-label">
                Time left
              </span>{" "}
              <span className="timer__value" id="xm-timer-value">
                01:12:40
              </span>
            </div>
          </header>
          {/* The banner row is always present so that the shell grid keeps its rows; the banners inside come and go. */}
          <div className="exam-shell__banner">
            <div role="status" />
          </div>
          <details className="exam-shell__navigator" id="navigator" role="region" aria-label="Questions" open>
            <summary>
              Questions{" "}
              <span className="text-meta" id="xm-answered-count">
                2 of 6 answered
              </span>
            </summary>
            <nav className="qnav" aria-label="Question navigator">
              <button type="button" className="qnav__item is-answered" data-go="1" aria-label="Question 1, answered">
                1
              </button>{" "}
              <button
                type="button"
                className="qnav__item is-answered is-marked"
                data-go="2"
                aria-label="Question 2, answered, to come back to"
              >
                2
              </button>{" "}
              <button
                type="button"
                className="qnav__item"
                data-go="3"
                aria-current="true"
                aria-label="Question 3, not answered, current"
              >
                3
              </button>{" "}
              <button type="button" className="qnav__item" data-go="4" aria-label="Question 4, not answered">
                4
              </button>{" "}
              <button
                type="button"
                className="qnav__item is-marked"
                data-go="5"
                aria-label="Question 5, not answered, to come back to"
              >
                5
              </button>{" "}
              <button type="button" className="qnav__item" data-go="6" aria-label="Question 6, not answered">
                6
              </button>
            </nav>
            <ul className="qnav__key" aria-label="Key">
              <li>
                <span className="qnav__item is-answered" aria-hidden="true">
                  1
                </span>
                Answered
              </li>
              <li>
                <span className="qnav__item" aria-hidden="true">
                  1
                </span>
                Not answered
              </li>
              <li>
                <span className="qnav__item is-marked" aria-hidden="true">
                  1
                </span>
                Come back to
              </li>
              <li>
                <span className="qnav__item" aria-current="true" aria-hidden="true">
                  1
                </span>
                The question you are on
              </li>
              <li>
                <span className="qnav__item is-local" aria-hidden="true">
                  1
                </span>
                On this device only
              </li>
            </ul>
            <div className="stack stack--sm u-mt-4">
              <button type="button" className="btn btn--secondary btn--block" id="xm-open-review">
                Review and submit
              </button>{" "}
              <button type="button" className="btn btn--ghost btn--block" id="xm-seconds">
                Hide seconds
              </button>
              <p className="text-small text-muted">
                Keyboard: <kbd className="kbd">Alt</kbd> + <kbd className="kbd">N</kbd> next question,{" "}
                <kbd className="kbd">Alt</kbd> + <kbd className="kbd">P</kbd> previous question,{" "}
                <kbd className="kbd">Alt</kbd> + <kbd className="kbd">T</kbd> hear the time left.
              </p>
              <p className="text-small">Problem? Tell your invigilator or coordinator.</p>
            </div>
          </details>
          <main className="exam-shell__main" id="question" tabIndex={-1}>
            <p className="u-print-only">Printing is switched off during this exam.</p>
            {/* Question 1: single choice */}
            <section data-q="1" data-type="Choose one answer" data-marks="4" aria-labelledby="q1-stem" hidden>
              <div className="cluster">
                <p className="question__number">Question 1 of 6 · 4 marks</p>
                <span className="tag tag--plain" data-marked-tag="" hidden>
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-bookmark" />
                  </svg>
                  To come back to
                </span>
              </div>
              <h1 className="question__stem" id="q1-stem" tabIndex={-1}>
                A colleague asks to see another employee&apos;s leave record. What should happen before the record is
                shown?
              </h1>
              <fieldset className="fieldset">
                <legend className="fieldset__legend">Choose one answer</legend>
                <div className="choice-group">
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q1" />
                    <span className="choice__title">
                      Show the record, because colleagues may see each other&apos;s leave
                    </span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q1" defaultChecked />
                    <span className="choice__title">
                      Write the request in the access register and get the office manager&apos;s approval
                    </span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q1" />
                    <span className="choice__title">Refuse, because leave records may never be shown to anyone</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q1" />
                    <span className="choice__title">
                      Ask the colleague to send the request by email, then show the record
                    </span>
                  </label>
                </div>
              </fieldset>
            </section>
            {/* Question 2: single choice */}
            <section data-q="2" data-type="Choose one answer" data-marks="4" aria-labelledby="q2-stem" hidden>
              <div className="cluster">
                <p className="question__number">Question 2 of 6 · 4 marks</p>
                <span className="tag tag--plain" data-marked-tag="" hidden>
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-bookmark" />
                  </svg>
                  To come back to
                </span>
              </div>
              <h1 className="question__stem" id="q2-stem" tabIndex={-1}>
                A supplier&apos;s invoice arrives without a purchase order number. What is the correct first step?
              </h1>
              <fieldset className="fieldset">
                <legend className="fieldset__legend">Choose one answer</legend>
                <div className="choice-group">
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q2" />
                    <span className="choice__title">Pay the invoice so that the supplier is not kept waiting</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q2" />
                    <span className="choice__title">File the invoice until the supplier asks about it</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q2" defaultChecked />
                    <span className="choice__title">
                      Record the invoice in the invoice register and ask the person who ordered for the purchase order
                      number
                    </span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q2" />
                    <span className="choice__title">Send the invoice back to the supplier without recording it</span>
                  </label>
                </div>
              </fieldset>
            </section>
            {/* Question 3: multiple choice */}
            <section data-q="3" data-type="Choose all that apply" data-marks="4" aria-labelledby="q3-stem">
              <div className="cluster">
                <p className="question__number">Question 3 of 6 · 4 marks</p>
                <span className="tag tag--plain" data-marked-tag="" hidden>
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-bookmark" />
                  </svg>
                  To come back to
                </span>
              </div>
              <h1 className="question__stem" id="q3-stem" tabIndex={-1}>
                Which of these belong in the minutes of a meeting?
              </h1>
              <fieldset className="fieldset">
                <legend className="fieldset__legend">Choose all the answers that apply</legend>
                <div className="choice-group">
                  <label className="choice">
                    <input className="choice__input" type="checkbox" name="q3" />
                    <span className="choice__title">The date, time and place of the meeting</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="checkbox" name="q3" />
                    <span className="choice__title">The names of the people present and the apologies received</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="checkbox" name="q3" />
                    <span className="choice__title">Every word that each person said</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="checkbox" name="q3" />
                    <span className="choice__title">The decisions taken and who is responsible for each action</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="checkbox" name="q3" />
                    <span className="choice__title">The chairperson&apos;s personal opinion of each staff member</span>
                  </label>
                </div>
              </fieldset>
            </section>
            {/* Question 4: single choice */}
            <section data-q="4" data-type="Choose one answer" data-marks="4" aria-labelledby="q4-stem" hidden>
              <div className="cluster">
                <p className="question__number">Question 4 of 6 · 4 marks</p>
                <span className="tag tag--plain" data-marked-tag="" hidden>
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-bookmark" />
                  </svg>
                  To come back to
                </span>
              </div>
              <h1 className="question__stem" id="q4-stem" tabIndex={-1}>
                The office printer stops working one hour before the board packs must be ready. What do you do first?
              </h1>
              <fieldset className="fieldset">
                <legend className="fieldset__legend">Choose one answer</legend>
                <div className="choice-group">
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q4" />
                    <span className="choice__title">
                      Wait for the technician, because only a technician may touch the printer
                    </span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q4" />
                    <span className="choice__title">
                      Tell your manager about the risk to the deadline and arrange another way to print
                    </span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q4" />
                    <span className="choice__title">Cancel the board meeting</span>
                  </label>{" "}
                  <label className="choice">
                    <input className="choice__input" type="radio" name="q4" />
                    <span className="choice__title">Email the board packs to everyone without asking</span>
                  </label>
                </div>
              </fieldset>
            </section>
            {/* Question 5: short written answer */}
            <section data-q="5" data-type="Short written answer" data-marks="6" aria-labelledby="q5-stem" hidden>
              <div className="cluster">
                <p className="question__number">Question 5 of 6 · 6 marks</p>
                <span className="tag tag--plain" data-marked-tag="" hidden>
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-bookmark" />
                  </svg>
                  To come back to
                </span>
              </div>
              <h1 className="question__stem" id="q5-stem" tabIndex={-1}>
                Explain why an office keeps an access register for confidential records.
              </h1>
              <div className="field">
                <label className="field__label" htmlFor="q5-answer">
                  Your answer
                </label>
                <p className="field__help" id="q5-help">
                  Write two or three sentences.
                </p>
                <textarea
                  className="textarea"
                  id="q5-answer"
                  name="q5"
                  rows={5}
                  aria-describedby="q5-help q5-count"
                  spellCheck="true"
                />
                <div className="field__footer">
                  <span className="field__count" id="q5-count" data-count="">
                    0 words
                  </span>
                </div>
              </div>
              <p className="question__notice" role="status">
                Pasting is switched off during this exam.
              </p>
            </section>
            {/* Question 6: long written answer */}
            <section data-q="6" data-type="Long written answer" data-marks="20" aria-labelledby="q6-stem" hidden>
              <div className="cluster">
                <p className="question__number">Question 6 of 6 · 20 marks</p>
                <span className="tag tag--plain" data-marked-tag="" hidden>
                  <svg className="icon icon--sm" aria-hidden="true">
                    <use href="#i-bookmark" />
                  </svg>
                  To come back to
                </span>
              </div>
              <h1 className="question__stem" id="q6-stem" tabIndex={-1}>
                Your manager asks you to arrange a one-day training workshop for 24 staff members. Describe the steps
                you would take, from the day you get the request to the day after the workshop.
              </h1>
              <div className="field">
                <label className="field__label" htmlFor="q6-answer">
                  Your answer
                </label>
                <p className="field__help" id="q6-help">
                  Include the venue, catering, equipment, how you would tell people, and the records you would keep. Aim
                  for 200 to 300 words.
                </p>
                <textarea
                  className="textarea textarea--feedback"
                  id="q6-answer"
                  name="q6"
                  rows={12}
                  aria-describedby="q6-help q6-count"
                  spellCheck="true"
                />
                <div className="field__footer">
                  <span className="field__count" id="q6-count" data-count="">
                    0 words
                  </span>
                </div>
              </div>
              <p className="question__notice" role="status">
                Pasting is switched off during this exam.
              </p>
            </section>
            {/* Review and submit (UX architecture 8.1 and 8.7) */}
            <section data-view="review" aria-labelledby="xm-review-title" hidden>
              <p className="question__number">Review and submit</p>
              <h1 className="question__stem" id="xm-review-title" tabIndex={-1}>
                Check your answers before you submit
              </h1>
              <p id="xm-review-summary">
                You have answered 2 of 6 questions. 4 questions have no answer. 2 questions are to come back to.
              </p>
              <p className="u-mt-4">
                <span className="status-line status-line--saved" data-review-status="saved">
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-cloud-check" />
                  </svg>
                  All your answers are saved.
                </span>{" "}
                <span className="status-line status-line--problem" data-review-status="local" hidden>
                  <svg className="icon" aria-hidden="true">
                    <use href="#i-device" />
                  </svg>
                  <span id="xm-review-local">
                    1 answer is saved on this device only. It will be sent when you submit, or as soon as the connection
                    is back.
                  </span>
                </span>
              </p>
              <div className="table-wrap xm-review">
                <table className="table">
                  <caption>
                    Your questions. Questions with no answer, and questions you marked, are listed first.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Question</th>
                      <th scope="col">Type and marks</th>
                      <th scope="col">Status</th>
                      <th scope="col">
                        <span className="u-visually-hidden">Open the question</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody id="xm-review-rows" />
                </table>
              </div>
              <p className="text-small text-muted u-mt-4">
                You may submit with questions that have no answer. They will get no marks.
              </p>
            </section>
          </main>
          <div className="exam-shell__actions" id="actions" tabIndex={-1} role="group" aria-label="Question actions">
            <button type="button" className="btn btn--secondary" id="xm-prev">
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-arrow-left" />
              </svg>
              Previous
            </button>{" "}
            <button type="button" className="btn btn--ghost" id="xm-mark" aria-pressed="false">
              <svg className="icon icon--sm" aria-hidden="true" id="xm-mark-off">
                <use href="#i-bookmark" />
              </svg>
              Come back to this later
            </button>{" "}
            <button type="button" className="btn btn--primary" id="xm-next">
              Next
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-arrow-right" />
              </svg>
            </button>{" "}
            <button type="button" className="btn btn--primary" id="xm-to-review" hidden>
              Review and submit
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-arrow-right" />
              </svg>
            </button>{" "}
            <button type="button" className="btn btn--primary" id="xm-submit" hidden>
              Submit exam
            </button>
          </div>
        </div>
        {/* Integrity overlay (FR-903). Says what happened, that it was noted, who will look, how to return. Never accuses, never threatens an outcome, never shows the threshold. In production the button re-requests fullscreen (browsers only allow that from a user action). The prototype does not call requestFullscreen. */}
        {/* Time is up. The visible timer ended at the end of the attempt. The final answers are being sent and the attempt submits by itself. The server's short acceptance window is a transport tolerance: it is never described as time. */}
        {/* Takeover screen: a newer tab holds the editing lease. No answers are shown. There is no "Try again". */}
      </div>
      {/* Below 1024px: the mobile gate, shown in place of the exam (NFR-10). An attempt is already running, so the true time left is shown. */}
      <div className="exam-notice xm-gate">
        <div className="exam-notice__panel">
          <p className="text-overline">Khanya Skills Institute · Unit 5 summative exam</p>
          <h1 className="exam-notice__title u-mt-2">
            <svg className="icon icon--lg" aria-hidden="true">
              <use href="#i-laptop" />
            </svg>
            You need a laptop or desktop computer to carry on with this exam
          </h1>
          <div className="exam-notice__body">
            <p>
              Your exam has started and the timer is still running. Phones and tablets cannot be used, because the exam
              needs a full-screen mode that they do not support properly.
            </p>
            <p>
              Open the LMS on a laptop or desktop computer as soon as you can, and select &quot;Resume exam&quot;. The
              answers you have saved are safe.
            </p>
            <p className="xm-gate__fine">
              Are you on a computer? This window is narrower than the exam needs. Make the browser window wider. If you
              have zoomed in so that you can read more easily, you can carry on at this size.
            </p>
          </div>
          <p className="exam-notice__fact">
            Time left <span data-time-left="">01:12:40</span> · exam open until 12:00 on Wednesday 14 October 2026
          </p>
          <p className="text-small">Problem? Tell your invigilator or coordinator.</p>
          <div className="exam-notice__actions">
            <Link className="btn btn--secondary" href="/learn/exams/unit-5-exam">
              Back to the exam information
            </Link>{" "}
            <button type="button" className="btn btn--ghost xm-gate__fine" id="xm-narrow-ok">
              Carry on at this size
            </button>
          </div>
        </div>
      </div>
      {/* Row for the review table. Cloned by the page script so that every class stays in the markup. */}
      {/* Consequence dialog: irreversible command, default focus on the safe action, explicit acknowledgement. */}
      <dialog className="modal" id="m-submit-exam" aria-labelledby="m-submit-title" data-modal-static="">
        <div className="modal__header">
          <h2 className="modal__title" id="m-submit-title">
            Submit your exam?
          </h2>
        </div>
        <div className="modal__body">
          <p className="modal__consequence">You cannot change your answers after this. Submitting cannot be undone.</p>
          <p>
            Unit 5 summative exam. You have answered <strong id="m-answered">2 of 6</strong> questions.
          </p>
          <ul className="modal__list">
            <li id="m-unanswered">
              <strong>4 questions have no answer:</strong> questions 3, 4, 5 and 6.
            </li>
            <li id="m-marked">
              <strong>2 questions are to come back to:</strong> questions 2 and 5.
            </li>
            <li>
              You still have{" "}
              <span className="mono" data-time-left="">
                01:12:40
              </span>{" "}
              left, so you may go back and check first.
            </li>
          </ul>
          <label className="check">
            <input className="check__input" type="checkbox" id="ack-submit" />
            <span className="check__label">I understand that I cannot change my answers after submitting.</span>
          </label>
        </div>
        <div className="modal__footer">
          <button type="button" className="btn btn--secondary" data-modal-close="" autoFocus>
            Go back
          </button>
          <button type="button" className="btn btn--primary" id="m-submit-confirm" data-requires="#ack-submit">
            Submit exam
          </button>
        </div>
      </dialog>
    </>
  );
}
