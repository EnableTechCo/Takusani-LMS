import { Actions, Block } from "@/components/skeleton/skeleton";

export const metadata = { title: "Exam receipt" };

// L-13 skeleton. Still inside ExamShell: the exam bar only, then a link back to the LMS.
export default function ExamReceiptPage() {
  return (
    <>
      <header className="exam-bar">
        <span className="exam-bar__title">Exam title</span>
      </header>
      <main className="page page--prose" id="main" tabIndex={-1}>
        <header className="page-header">
          <h1 className="page-header__title">Your exam is submitted</h1>
          <div className="page-header__meta">
            <span className="tag">Skeleton</span>
            <span className="text-meta mono">L-13 · FR-315</span>
          </div>
        </header>
        <div className="stack stack--lg">
          <Block
            label="Receipt"
            detail="Receipt ID, submitted time, how it was submitted, answered count, recorded events count"
            size="lg"
          />
          <Actions actions={[{ label: "Return to the LMS", href: "/learn" }]} className="cluster" />
        </div>
      </main>
    </>
  );
}
