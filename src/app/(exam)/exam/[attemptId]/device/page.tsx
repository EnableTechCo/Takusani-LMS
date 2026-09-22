import { Actions, Block } from "@/components/skeleton/skeleton";

export const metadata = { title: "You need a computer for this exam" };

// Mobile gate (UX architecture 9.4, NFR-10): shown instead of the exam on a phone or tablet.
export default function ExamDevicePage() {
  return (
    <main className="page page--prose" id="main" tabIndex={-1}>
      <header className="page-header">
        <h1 className="page-header__title">You need a computer for this exam</h1>
        <div className="page-header__meta">
          <span className="tag">Skeleton</span>
          <span className="text-meta mono">L-12 mobile gate · NFR-10</span>
        </div>
      </header>
      <div className="stack stack--lg">
        <Block
          label="Why, and what to do"
          detail="Phones and tablets cannot start or resume an exam. Open this exam on a computer before the window closes; the time left is shown."
        />
        <Actions actions={[{ label: "Back to the exam details", href: "/learn/exams/example" }]} className="cluster" />
      </div>
    </main>
  );
}
