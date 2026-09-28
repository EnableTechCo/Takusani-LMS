import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { NewQuizForm } from "@/modules/learning/quiz-forms";
import { listQuizzes } from "@/modules/learning/quiz-queries";
import { listWorkCohorts } from "@/modules/submissions/queries";

export const metadata = { title: "Quizzes · Teaching" };

const STATE_LABELS: Record<string, string> = { draft: "Draft", published: "Published", archived: "Archived" };

// F-05 (FR-205): practice quizzes for your cohorts, built from the programme's question bank. They never count
// towards a result (FR-303); how learners do is shown here as engagement only.
export default async function QuizzesPage() {
  const [quizzes, cohorts] = await Promise.all([listQuizzes(), listWorkCohorts()]);
  return (
    <div className="page">
      <PageHeader
        lead="Practice quizzes with instant scores and feedback. They never count towards a result."
        title="Quizzes"
        workspace="Teaching"
      />
      <div className="page-layout">
        <div className="page-layout__main">
          {quizzes.length === 0 ? (
            <div className="card">
              <EmptyState icon="clipboard" title="No quizzes yet">
                <p>Create one, add questions from the bank or new ones, then publish it for a cohort.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Your quizzes, most recently changed first; archived last."
              columns={[
                {
                  key: "title",
                  header: "Quiz",
                  primary: true,
                  cell: (quiz) => (
                    <>
                      <TextLink href={`/teach/quizzes/${quiz.id}/edit`}>{quiz.title}</TextLink>
                      <span className="table__secondary">{quiz.cohort_name}</span>
                    </>
                  ),
                },
                { key: "questions", header: "Questions", numeric: true, cell: (quiz) => quiz.questions },
                { key: "attempts", header: "Attempts allowed", numeric: true, cell: (quiz) => quiz.attempt_limit },
                {
                  key: "tried",
                  header: "Learners who tried it",
                  cell: (quiz) =>
                    quiz.learners_tried > 0
                      ? `${quiz.learners_tried}, average best ${quiz.average_best_percent}%`
                      : "None yet",
                },
                {
                  key: "state",
                  header: "State",
                  cell: (quiz) => (
                    <Tag tone={quiz.state === "published" ? "positive" : "neutral"}>{STATE_LABELS[quiz.state]}</Tag>
                  ),
                },
              ]}
              rowKey={(quiz) => quiz.id}
              rows={quizzes}
            />
          )}
        </div>
        <aside aria-labelledby="new-quiz-h" className="page-layout__aside">
          <div className="card">
            <div className="card__body stack">
              <h2 className="text-heading" id="new-quiz-h">
                New quiz
              </h2>
              <NewQuizForm
                cohorts={cohorts.map((cohort) => ({
                  id: cohort.id,
                  label: `${cohort.name}, ${cohort.programme_title}`,
                }))}
              />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
