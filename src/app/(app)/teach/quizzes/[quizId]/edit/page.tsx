import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { archiveQuiz, publishQuiz } from "@/modules/learning/quiz-actions";
import { QuestionForm, QuizSetupForm } from "@/modules/learning/quiz-forms";
import { getQuiz, listQuestionBank } from "@/modules/learning/quiz-queries";
import { QUIZ_REFUSALS } from "@/modules/learning/quiz-rules";
import { isUuid } from "@/modules/submissions/rules";

export const metadata = { title: "Quiz · Teaching" };

// F-05 (FR-205): one quiz. While it is a draft: its details, attempt limit and questions (from the programme's bank,
// or new ones added to it), then publish. Once published it is fixed, and learners in the cohort can take it.
export default async function EditQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ publish?: string }>;
}) {
  const [{ quizId }, flash] = await Promise.all([params, searchParams]);
  if (!isUuid(quizId)) notFound();
  const quiz = await getQuiz(quizId);
  if (!quiz) notFound();
  const bank = await listQuestionBank(quiz.programme_id);
  const draft = quiz.state === "draft";
  const total = quiz.questions.reduce((sum, question) => sum + question.points, 0);

  return (
    <div className="page">
      <PageHeader
        lead={quiz.cohort_name}
        meta={
          <>
            <Tag tone={quiz.state === "published" ? "positive" : "neutral"}>
              {draft ? "Draft" : quiz.state === "published" ? "Published" : "Archived"}
            </Tag>
            <span>
              {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"}, {total} points,{" "}
              {quiz.attempt_limit} {quiz.attempt_limit === 1 ? "attempt" : "attempts"}
            </span>
            {quiz.published_at ? <span>Published {formatDateTime(quiz.published_at)} (SAST)</span> : null}
          </>
        }
        title={quiz.title}
        workspace="Teaching"
      />
      <div className="stack stack--lg">
        <Banner role="note" title="Practice only" tone="info">
          <p>Learners see their score and feedback at once. Quizzes never count towards a result or a credit.</p>
        </Banner>
        {flash.publish === "ok" ? (
          <Banner compact role="status" title="Published: learners in the cohort can take it now" tone="positive" />
        ) : flash.publish ? (
          <Banner compact title={QUIZ_REFUSALS[flash.publish] ?? QUIZ_REFUSALS.error} tone="critical" />
        ) : null}

        {draft ? (
          <>
            <section aria-labelledby="setup-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="setup-h">
                  Details and questions
                </h2>
              </div>
              <div className="card__body">
                <QuizSetupForm
                  bank={bank.map((item) => ({ id: item.id, prompt: item.prompt, kind: item.kind }))}
                  key={JSON.stringify(quiz.questions.map((question) => question.question_id))}
                  quiz={{
                    id: quiz.id,
                    title: quiz.title,
                    description: quiz.description,
                    attempt_limit: quiz.attempt_limit,
                    questions: quiz.questions.map((question) => ({
                      question_id: question.question_id,
                      points: question.points,
                    })),
                  }}
                />
              </div>
            </section>
            <section aria-labelledby="new-question-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="new-question-h">
                  Write a new question
                </h2>
              </div>
              <div className="card__body">
                <QuestionForm
                  current={quiz.questions.map((question) => ({
                    question_id: question.question_id,
                    points: question.points,
                  }))}
                  programmeId={quiz.programme_id}
                  quizId={quiz.id}
                />
              </div>
            </section>
            <section aria-labelledby="publish-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="publish-h">
                  Publish
                </h2>
              </div>
              <div className="card__body stack">
                {quiz.questions.length === 0 ? (
                  <p className="text-muted">Add at least one question first.</p>
                ) : (
                  <form action={publishQuiz.bind(null, quiz.id)} id="publish-quiz-form">
                    <ConsequenceDialog
                      cancelLabel="Keep editing"
                      confirmLabel="Publish quiz"
                      consequence={`Learners in ${quiz.cohort_name} can take it at once, up to ${quiz.attempt_limit} ${quiz.attempt_limit === 1 ? "time" : "times"}. Once published, the quiz and its questions are fixed.`}
                      form="publish-quiz-form"
                      title={`Publish ${quiz.title}?`}
                      trigger={{ label: "Publish quiz" }}
                    />
                  </form>
                )}
              </div>
            </section>
          </>
        ) : (
          <section aria-labelledby="questions-h" className="card">
            <div className="card__header">
              <h2 className="card__title" id="questions-h">
                Questions
              </h2>
            </div>
            <div className="card__body">
              <ol className="stack" role="list">
                {quiz.questions.map((question, index) => (
                  <li key={question.question_id}>
                    <strong>
                      {index + 1}. {question.prompt}
                    </strong>{" "}
                    <span className="text-small text-muted">
                      ({question.points} {question.points === 1 ? "point" : "points"})
                    </span>
                    <ul className="text-small" role="list">
                      {question.options.map((option) => (
                        <li key={option.id}>
                          {question.correct.includes(option.id) ? "Right: " : ""}
                          {option.text}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}

        <div className="cluster cluster--between">
          <TextLink href="/teach/quizzes">All quizzes</TextLink>
          {quiz.state !== "archived" ? (
            <form action={archiveQuiz.bind(null, quiz.id)}>
              <Button type="submit" variant="ghost">
                Archive this quiz
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
