import Link from "next/link";

export const metadata = { title: "You need a computer for this exam" };

// Ported from docs/design/ui/prototype/exam-mobile-gate.html (default state). Static shell: no data or behaviour yet.
export default function ExamMobileGatePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      {/* What a phone or tablet shows at /exam/[attemptId] in place of the exam. The gate runs before an attempt is created, so a refused device never uses an attempt or starts a timer. ExamShell: no navigation components. */}
      <main className="exam-notice" id="main" tabIndex={-1}>
        <div className="exam-notice__panel">
          <p className="text-overline">Khanya Skills Institute · Unit 5 summative exam</p>
          <h1 className="exam-notice__title u-mt-2">
            <svg className="icon icon--lg" aria-hidden="true">
              <use href="#i-laptop" />
            </svg>
            <span>You need a laptop or desktop computer to sit this exam</span>
          </h1>
          <div className="exam-notice__body">
            <p>
              Phones and tablets cannot be used, because the exam needs a full-screen mode that they do not support
              properly.
            </p>
            <p>
              <strong>The exam has not started. No attempt and no time have been used.</strong>
            </p>
          </div>
          <p className="exam-notice__fact">Open from 09:00 to 12:00 on Wednesday 14 October 2026 (SAST)</p>
          <div className="exam-notice__body">
            <h2 className="text-subheading">What you need</h2>
            <ul className="modal__list">
              <li>A laptop or desktop computer with a keyboard. A tablet with a keyboard cannot be used.</li>
              <li>An up-to-date browser: Chrome, Edge or Firefox.</li>
              <li>A normal browser window, not a private window.</li>
            </ul>
            <p>
              You can check a computer at any time before the exam day. Sign in on that computer, open this exam, and
              look under &quot;Check this device&quot;.
            </p>
            <p>
              If you do not have a computer you can use, speak to your coordinator, Zanele Dlamini,{" "}
              <span>before the exam day.</span>
            </p>
            <p className="text-small text-muted">
              On this phone or tablet you can still read the exam rules, see when the exam is open, and see your result
              later.
            </p>
          </div>
          <div className="exam-notice__actions">
            <Link className="btn btn--primary" href="/learn/exams/unit-5-exam">
              Read the exam information
            </Link>{" "}
            <Link className="btn btn--secondary" href="/learn">
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
