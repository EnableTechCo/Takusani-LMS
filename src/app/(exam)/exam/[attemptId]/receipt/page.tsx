import Link from "next/link";
import "./page.css";

export const metadata = { title: "Exam receipt: Unit 5 summative exam" };

// Ported from docs/design/ui/prototype/exam-receipt.html (default state). Static shell: no data or behaviour yet.
export default function ExamReceiptPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {/* Still in the ExamShell route group: exam bar only, no navigation components. The way out is the button at the end. Fullscreen exits on arrival. Any later visit to the exam address lands here, and a repeated submit returns this same receipt. */}
      <header className="exam-bar">
        <span className="exam-bar__title">Unit 5 summative exam</span>{" "}
        <span className="status-line status-line--locked" role="status">
          <svg className="icon" aria-hidden="true">
            <use href="#i-lock" />
          </svg>
          Submitted and locked
        </span>
      </header>
      <main className="page page--prose" id="main" tabIndex={-1}>
        <header className="page-header">
          <p className="text-overline">Khanya Skills Institute · Exam receipt</p>
          <h1 className="page-header__title">
            <span>Your exam has been submitted</span>
          </h1>
          <p className="page-header__lead">
            We have your answers. They are locked and cannot be changed. You do not need to do anything else today.
          </p>
          <div className="page-header__meta">
            <span className="tag tag--positive">Submitted 10:58</span>{" "}
          </div>
        </header>
        <div className="receipt" role="group" aria-labelledby="rc-title">
          <p className="receipt__title" id="rc-title">
            <svg className="icon" aria-hidden="true">
              <use href="#i-check-circle" />
            </svg>
            We have your exam
          </p>
          <code className="receipt__id" id="rc-id">
            {"EX-2026-000931"}
          </code>
          <dl className="receipt__rows">
            <div className="receipt__row">
              <dt>Learner</dt>
              <dd>Lerato Mokoena · KSI-2026-0417</dd>
            </div>
            <div className="receipt__row">
              <dt>Exam</dt>
              <dd>Unit 5 summative exam · Unit 5: Office administration</dd>
            </div>
            <div className="receipt__row">
              <dt>Attempt</dt>
              <dd>1 of 1</dd>
            </div>
            <div className="receipt__row">
              <dt>Started</dt>
              <dd>
                <time dateTime="2026-10-14T09:55:00+02:00">Wednesday 14 October 2026 at 09:55</time>
              </dd>
            </div>
            <div className="receipt__row">
              <dt>Submitted</dt>
              <dd>
                <time dateTime="2026-10-14T10:58:00+02:00">Wednesday 14 October 2026 at 10:58 (SAST)</time>
              </dd>
            </div>
            <div className="receipt__row">
              <dt>How</dt>
              <dd>Submitted by you</dd>
            </div>
            <div className="receipt__row">
              <dt>Answered</dt>
              <dd>6 of 6 questions</dd>
            </div>
            <div className="receipt__row">
              <dt>Recorded</dt>
              <dd>2 moments when you left the exam window</dd>
            </div>
          </dl>
          <p className="receipt__note">
            Keep this reference in case you need to ask about this exam. You can find this receipt again under Exams.
          </p>
          <div className="receipt__actions">
            <button type="button" className="btn btn--secondary" id="rc-print">
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-printer" />
              </svg>
              Print this receipt
            </button>
            <button type="button" className="btn btn--ghost" id="rc-copy">
              <svg className="icon icon--sm" aria-hidden="true">
                <use href="#i-copy" />
              </svg>
              Copy reference
            </button>
          </div>
        </div>
        <section className="rc-section" aria-labelledby="rc-next-h">
          <h2 className="text-heading" id="rc-next-h">
            What happens next
          </h2>
          <div className="stack">
            <p>
              <span className="tag tag--info tag--shape-half">Being assessed</span>
            </p>
            <div className="prose">
              <p>
                Your assessor will mark your exam. In this programme, results are checked by a second person (a
                moderator) before anyone sees them, and everyone&apos;s results for the same exam are released together.
              </p>
              <p>
                We cannot give you a date yet. You will get a message in the LMS and by email when your result is ready.
                Until then this exam will show &quot;Being assessed&quot;.
              </p>
            </div>
          </div>
        </section>
        <section className="rc-section" aria-labelledby="rc-record-h">
          <h2 className="text-heading" id="rc-record-h">
            About the 2 recorded moments
          </h2>
          <div className="prose">
            <p>
              2 moments when you left the exam window were recorded. Your assessor will see the record and decide
              whether it matters. A record does not decide your result.
            </p>
            <p>
              If something outside your control caused them, for example a pop-up from another program, tell your
              coordinator, Zanele Dlamini.
            </p>
          </div>
        </section>
        <section className="rc-section" aria-labelledby="rc-done-h">
          <h2 className="text-heading" id="rc-done-h">
            You can leave the exam now
          </h2>
          <p className="u-measure">
            Your browser has left full-screen mode. The LMS menus and your notifications work again.
          </p>
          <div className="cluster u-mt-4 u-no-print">
            <Link className="btn btn--primary" href="/learn">
              Back to Home
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
