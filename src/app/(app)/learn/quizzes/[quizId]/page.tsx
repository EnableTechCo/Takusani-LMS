import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { startQuizAttempt } from "@/modules/learning/quiz-actions";
import { getMyQuiz } from "@/modules/learning/quiz-queries";
import { attemptsText, PRACTICE_NOTICE, QUIZ_REFUSALS, scoreText } from "@/modules/learning/quiz-rules";
import { isUuid } from "@/modules/submissions/rules";

export const metadata = { title: "Quiz" };

// L-06 (FR-302, FR-303, FR-205): a practice quiz. Labelled as practice, with the attempts used of the limit, and
// every past attempt's score. Starting resumes an attempt already open.
export default async function LearnQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ refused?: string }>;
}) {
  const [{ quizId }, flash] = await Promise.all([params, searchParams]);
  if (!isUuid(quizId)) notFound();
  const quiz = await getMyQuiz(quizId);
  if (!quiz) notFound();
  const used = quiz.attempts.length;
  const open = quiz.attempts.find((attempt) => attempt.state === "in_progress");
  const left = quiz.attempt_limit - used;
  const points = quiz.questions.reduce((sum, question) => sum + question.points, 0);

  return (
    <div className="page page--prose">
      <PageHeader
        meta={
          <>
            <Tag>Practice</Tag>
            <span>
              {quiz.questions.length} {quiz.questions.length === 1 ? "question" : "questions"}, {points} points
            </span>
            <span>{attemptsText(used, quiz.attempt_limit)}</span>
          </>
        }
        title={quiz.title}
        workspace="Learning"
      />
      <div className="stack stack--lg">
        <Banner role="note" title={PRACTICE_NOTICE} tone="info">
          <p>
            You see your score and feedback as soon as you submit. Your result for the assignment is decided separately.
          </p>
        </Banner>
        {flash.refused ? (
          <Banner compact title={QUIZ_REFUSALS[flash.refused] ?? QUIZ_REFUSALS.error} tone="critical" />
        ) : null}
        {quiz.description ? <p>{quiz.description}</p> : null}

        <form action={startQuizAttempt.bind(null, quiz.id)}>
          {open ? (
            <Button type="submit" variant="primary">
              Carry on with attempt {open.attempt_number}
            </Button>
          ) : left > 0 ? (
            <Button type="submit" variant="primary">
              {used === 0 ? "Start the quiz" : "Try again"}
            </Button>
          ) : (
            <p className="text-muted">You have used all {quiz.attempt_limit} attempts.</p>
          )}
        </form>
        {!open && left > 0 && used > 0 ? (
          <p className="text-small text-muted">{left === 1 ? "1 attempt left." : `${left} attempts left.`}</p>
        ) : null}

        {quiz.attempts.length > 0 ? (
          <DataTable
            caption="Your attempts. Times in SAST."
            columns={[
              {
                key: "attempt",
                header: "Attempt",
                primary: true,
                cell: (attempt) => (
                  <TextLink href={`/learn/quizzes/${quiz.id}/attempts/${attempt.attempt_id}`}>
                    Attempt {attempt.attempt_number}
                  </TextLink>
                ),
              },
              {
                key: "score",
                header: "Score",
                cell: (attempt) =>
                  attempt.state === "submitted" && attempt.score !== null && attempt.max_score !== null
                    ? scoreText(attempt.score, attempt.max_score)
                    : "Not submitted yet",
              },
              {
                key: "when",
                header: "Submitted",
                cell: (attempt) => (attempt.submitted_at ? formatDateTime(attempt.submitted_at) : "In progress"),
              },
            ]}
            rowKey={(attempt) => attempt.attempt_id}
            rows={quiz.attempts}
          />
        ) : null}
        <p>
          <TextLink href="/learn/materials">Back to materials</TextLink>
        </p>
      </div>
    </div>
  );
}
