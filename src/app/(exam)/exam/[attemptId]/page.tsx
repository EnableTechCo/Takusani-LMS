import { Actions, Block } from "@/components/skeleton/skeleton";

export const metadata = { title: "Exam" };

// L-12 skeleton (UX architecture section 8). ExamShell: no navigation, notifications, search or account menu (FR-901).
export default function ExamPage() {
  return (
    <>
      <a className="skip-link" href="#question">
        Skip to the question
      </a>
      <div className="exam-shell">
        <header className="exam-shell__bar exam-bar">
          <span className="exam-bar__title">Exam title</span>
          <span className="text-small text-muted">
            Question position · save status · connection status · timer (L-12 · FR-313 to FR-315, FR-901 to FR-905)
          </span>
        </header>
        <div className="exam-shell__banner">
          <Block
            label="Banners, only when needed"
            detail="Offline: answers are kept on this device. Integrity warning after leaving the exam window (FR-903). Low time."
            size="sm"
          />
        </div>
        <details className="exam-shell__navigator" open>
          <summary>Questions</summary>
          <Block
            label="Question navigator"
            detail="Answered, not answered, come back to, current; Review and submit"
            size="lg"
          />
        </details>
        <main className="exam-shell__main" id="question" tabIndex={-1}>
          <Block
            label="One question per page"
            detail="Question text, marks, and the answer control; saved every few seconds and on every change."
            size="xl"
          />
        </main>
        <div className="exam-shell__actions">
          <Actions actions={["Next", "Previous", "Come back to this later"]} className="cluster" />
        </div>
      </div>
    </>
  );
}
