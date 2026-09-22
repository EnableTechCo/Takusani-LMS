import Link from "next/link";
import "./page.css";

export const metadata = { title: "Unit 5 summative exam: before you start" };

// Ported from docs/design/ui/prototype/learn-exam-preflight.html (default state). Static shell: no data or behaviour yet.
export default function LearnExamPreflightPage() {
  return (
    <>
      <div className="page page--prose">
        <header className="page-header">
          <nav aria-label="Breadcrumb">
            <ol className="breadcrumb">
              <li>
                <Link href="/learn">Home</Link>
              </li>
              <li>
                <Link href="/learn/exams/unit-5-exam">Exams</Link>
              </li>
              <li aria-current="page">Unit 5 summative exam</li>
            </ol>
          </nav>
          <p className="text-overline">Exam · Unit 5: Office administration</p>
          <h1 className="page-header__title">Unit 5 summative exam</h1>
          <p className="page-header__lead">
            Read this page before you start. It tells you how long you have, what is switched off during the exam, and
            what is recorded.
          </p>
          <div className="page-header__meta">
            <span className="tag tag--info">
              Open now, until <span>12:00</span>
            </span>{" "}
            <span>2026 Intake B</span>
          </div>
        </header>
        {/* ========== State messages (first screenful) ========== */}
        {/* Attempt already in progress */}
        {/* Window not open yet (FR-312: the reason and the opening time) */}
        {/* Window closed */}
        {/* A device check failed */}
        {/* Accommodation applied (decision U-02): the learner's OWN duration, in plain words */}
        {/* ========== 1. Exam facts ========== */}
        <section className="pf-section" aria-labelledby="pf-facts-h">
          <h2 className="text-heading" id="pf-facts-h">
            About this exam
          </h2>
          <div className="card">
            <div className="card__body">
              <dl className="dl dl--inline">
                <div className="dl__row">
                  <dt>When</dt>
                  <dd>
                    <time dateTime="2026-10-14T09:00:00+02:00">
                      Wednesday 14 October 2026, open from 09:00 to <span>12:00</span> (SAST)
                    </time>
                    . You may start at any time while it is open.
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Your time</dt>
                  <dd>
                    2 hours, from the moment you start. If you start after 10:00 you will have less than 2 hours,
                    because the exam closes at 12:00.
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Attempts</dt>
                  <dd>
                    <span>1 attempt. You have used 0 of 1.</span>
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Questions</dt>
                  <dd>
                    6 questions, 42 marks. One question on the screen at a time. You can move between questions and
                    change your answers until you submit.
                  </dd>
                </div>
                <div className="dl__row">
                  <dt>Device</dt>
                  <dd>A laptop or desktop computer. Phones and tablets cannot be used.</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>
        <section className="pf-section" aria-labelledby="pf-support-h">
          <h2 className="text-heading" id="pf-support-h">
            If you need more time or use assistive software
          </h2>
          <div className="card">
            <div className="card__body stack stack--sm">
              <p className="text-body u-measure">
                You can ask for extra time, or tell us that you use software such as a screen reader, a screen
                magnifier, speech-to-text or an on-screen keyboard. This must be set up before you start. It cannot be
                changed once the exam has begun.
              </p>
              <p className="text-body u-measure">
                <strong>Ask by the end of Wednesday 7 October 2026.</strong> Your coordinator is Zanele Dlamini. You do
                not need to explain a medical condition. You only choose what you need.
              </p>
              <p>
                <a
                  className="link link--standalone"
                  href="mailto:zanele.dlamini@khanya.example?subject=Exam%20support%20for%20Unit%205%20summative%20exam"
                >
                  Ask Zanele Dlamini about exam support
                </a>
              </p>
            </div>
          </div>
        </section>
        {/* ========== 2. Device check ========== */}
        <section className="pf-section" aria-labelledby="pf-check-h">
          <div className="section__header">
            <h2 className="text-heading" id="pf-check-h">
              Check this device
            </h2>
            <button type="button" className="btn btn--secondary" id="pf-recheck">
              Run the check again
            </button>
          </div>
          <ul className="checklist" aria-label="Device check">
            <li className="checklist__item checklist__item--pass pf-desktop-only">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-check-circle" />
              </svg>
              <span className="checklist__title">Laptop or desktop browser</span>
              <span className="tag tag--positive">Pass</span>
            </li>
            <li className="checklist__item checklist__item--pass pf-zoomed-only">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-info" />
              </svg>
              <span className="checklist__title">This window is narrow</span>
              <span className="checklist__detail">
                If you have zoomed in so that you can read more easily, that is fine. The exam works at this size.
              </span>
            </li>
            <li className="checklist__item checklist__item--problem pf-narrow-only">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-info" />
              </svg>
              <span className="checklist__title">Laptop or desktop browser</span>
              <span className="tag tag--caution">Problem</span>
              <span className="checklist__detail">
                This looks like a phone, a tablet or a small window. Open the LMS on a laptop or desktop computer to sit
                the exam.
              </span>
            </li>
            <li className="checklist__item checklist__item--pass">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-check-circle" />
              </svg>
              <span className="checklist__title">Full-screen mode is available</span>
              <span className="tag tag--positive">Pass</span>
            </li>
            <li className="checklist__item checklist__item--pass">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-check-circle" />
              </svg>
              <span className="checklist__title">The browser can tell when the exam window is in view</span>
              <span className="tag tag--positive">Pass</span>
            </li>
            <li className="checklist__item checklist__item--pass">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-check-circle" />
              </svg>
              <span className="checklist__title">This device can keep a safety copy of your answers</span>
              <span className="tag tag--positive">Pass</span>
            </li>
            <li className="checklist__item checklist__item--pass">
              <svg className="icon checklist__icon" aria-hidden="true">
                <use href="#i-check-circle" />
              </svg>
              <span className="checklist__title">Connection to the LMS</span>
              <span className="tag tag--positive">Pass</span>
              <span className="checklist__detail">
                Good. If the connection drops during the exam, you can carry on. See &quot;If your connection
                drops&quot; on this page.
              </span>
            </li>
          </ul>
          <p className="text-small text-muted u-mt-2" role="status">
            <span id="pf-check-result">
              <span>Checked just now. All checks passed on a laptop or desktop computer.</span>
            </span>
            <span id="pf-checking" hidden>
              Checking this device
            </span>
          </p>
        </section>
        {/* ========== 3. What happens in exam mode (FR-901) ========== */}
        <section className="pf-section" aria-labelledby="pf-mode-h">
          <h2 className="text-heading" id="pf-mode-h">
            What happens in exam mode
          </h2>
          <div className="prose">
            <p>
              The exam fills the whole screen. This is so that the exam is the only thing in front of you, and so that
              the exam is fair for everyone.
            </p>
            <h3>What is switched off, and why</h3>
            <ul>
              <li>The LMS menus, search and notifications. Nothing else in the LMS can be opened until you submit.</li>
              <li>Copying, cutting and pasting. Your answers must be typed during the exam, in your own words.</li>
              <li>The right-click menu, and selecting the text of a question.</li>
              <li>Printing.</li>
            </ul>
            <h3>What still works</h3>
            <ul>
              <li>Typing, undo, the arrow keys and the spelling checker.</li>
              <li>Making the text bigger with your browser&apos;s zoom.</li>
              <li>Screen readers and other assistive software.</li>
            </ul>
            <h3>The timer does not stop</h3>
            <p>
              Your time starts when the exam starts. The timer keeps running if you leave the exam window, if you close
              the browser, and if your connection drops. When your time ends, the exam is submitted for you
              automatically with the answers you have given. You get a receipt either way.
            </p>
          </div>
        </section>
        {/* ========== 4. What is recorded (FR-902, FR-903) ========== */}
        <section className="pf-section" aria-labelledby="pf-log-h">
          <h2 className="text-heading" id="pf-log-h">
            What is recorded
          </h2>
          <div className="prose">
            <p>The LMS records these moments, with the time:</p>
            <ul>
              <li>when you leave the exam window, for example by switching to another tab or program</li>
              <li>when the browser leaves full-screen mode</li>
              <li>when you come back.</li>
            </ul>
            <p>
              If this happens, a message tells you that it was recorded and how to return. Your exam carries on. A
              record does not end your exam and does not decide your result. Your assessor sees the record and decides
              whether it matters.
            </p>
            <p>
              <strong>Not recorded:</strong> your camera, your microphone, your screen, and anything you do outside the
              LMS.
            </p>
            <p>
              Before you start, close other programs and turn off notifications, so that nothing takes you out of the
              exam window by accident. If something outside your control does, tell your coordinator after the exam.
            </p>
          </div>
        </section>
        {/* ========== 5. If your connection drops (NFR-07, P-13) ========== */}
        <section className="pf-section" aria-labelledby="pf-offline-h">
          <h2 className="text-heading" id="pf-offline-h">
            If your connection drops
          </h2>
          <div className="prose">
            <ul>
              <li>
                Carry on answering. Every answer is kept on this device straight away, and saved to the server about
                every 10 seconds. The top of the exam always shows where your answers are: &quot;Saved on this
                device&quot; or &quot;Saved&quot; with the time.
              </li>
              <li>
                <strong>The timer keeps running while you are offline.</strong>
              </li>
              <li>When the connection comes back, all your answers are saved to the server together.</li>
              <li>
                If the browser closes or the computer restarts, open the LMS again on the same computer and select
                &quot;Resume exam&quot;.
              </li>
              <li>
                If you lose your connection for a long time, tell your coordinator, Zanele Dlamini, what happened as
                soon as you can.
              </li>
            </ul>
          </div>
        </section>
        {/* ========== 6. Start ========== */}
        <section className="pf-section" aria-labelledby="pf-start-h">
          <h2 className="text-heading" id="pf-start-h">
            Start the exam
          </h2>
          {/* From 1024px: the Start area */}
          <div className="card pf-desktop-only">
            <div className="card__body stack">
              <p>
                When you select &quot;Start exam&quot;, your browser will ask to show the exam in full screen.{" "}
                <strong>The exam and the timer start only after the screen has gone full screen.</strong> If it does
                not, the exam has not started and no time has been used. You can then select &quot;Start exam&quot;
                again.
              </p>
              {/* Ready, or ready with an accommodation: acknowledgement gates Start */}
              <form className="stack">
                <label className="check">
                  <input className="check__input" type="checkbox" id="pf-ack" />
                  <span className="check__label">
                    I have read what is switched off and what is recorded. I understand that the timer does not stop
                    once I start.
                  </span>
                </label>
                <div className="cluster">
                  <button
                    type="submit"
                    className="btn btn--primary btn--lg"
                    data-requires="#pf-ack"
                    aria-describedby="pf-start-note"
                  >
                    Start exam
                  </button>
                  <p className="text-small text-muted" id="pf-start-note">
                    You will have <span>2 hours</span>. Tick the box to switch on the button.
                  </p>
                </div>
              </form>
              {/* Not open yet: the reason and the opening time, as text */}
              {/* A check failed: Start is disabled and the reason is named */}
            </div>
          </div>
          {/* Below 1024px: the mobile gate replaces the Start area. It runs before any attempt exists, so no time is used. */}
          <div className="exam-notice__panel pf-gate pf-narrow-only">
            <h3 className="exam-notice__title">
              <svg className="icon icon--lg" aria-hidden="true">
                <use href="#i-laptop" />
              </svg>
              You need a laptop or desktop computer to sit this exam
            </h3>
            <div className="exam-notice__body">
              <p>
                Phones and tablets cannot be used, because the exam needs a full-screen mode that they do not support
                properly. The exam has not started and no time has been used.
              </p>
              <p>
                You can still read this page here. If you do not have a computer you can use, speak to your coordinator,
                Zanele Dlamini, before the exam day.
              </p>
            </div>
            <p className="exam-notice__fact">
              Open from 09:00 to <span>12:00</span> on Wednesday 14 October 2026
            </p>
            <div className="exam-notice__actions">
              <Link className="btn btn--secondary" href="/exam/attempt-1/device">
                What you need for the exam
              </Link>
              <Link className="btn btn--ghost" href="/learn">
                Back to Home
              </Link>
            </div>
          </div>
        </section>
        {/* Resume on a phone or tablet: the gate, with the true time left */}
      </div>
    </>
  );
}
