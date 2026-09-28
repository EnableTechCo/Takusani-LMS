import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { AttemptForm } from "@/modules/learning/quiz-forms";
import { getMyQuizAttempt } from "@/modules/learning/quiz-queries";
import { PRACTICE_NOTICE, scoreText } from "@/modules/learning/quiz-rules";
import { isUuid } from "@/modules/submissions/rules";

export const metadata = { title: "Quiz attempt" };

// L-06 (FR-302): answering an attempt, then its score and each answer's automatic feedback. The right answers are
// shown once no attempts are left, so a later attempt is still the learner's own work.
export default async function QuizAttemptPage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string; attemptId: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const [{ quizId, attemptId }, flash] = await Promise.all([params, searchParams]);
  if (!isUuid(attemptId)) notFound();
  const attempt = await getMyQuizAttempt(attemptId);
  if (!attempt || attempt.quiz_id !== quizId) notFound();
  const submitted = attempt.state === "submitted";

  return (
    <div className="page page--prose">
      <PageHeader
        meta={
          <>
            <Tag>Practice</Tag>
            <span>
              Attempt {attempt.attempt_number} of {attempt.attempt_limit}
            </span>
          </>
        }
        title={attempt.quiz_title}
        workspace="Learning"
      />
      <div className="stack stack--lg">
        {submitted && attempt.score !== null && attempt.max_score !== null ? (
          <Banner
            role={flash.submitted ? "status" : undefined}
            title={`Your score: ${scoreText(attempt.score, attempt.max_score)}`}
            tone="positive"
          >
            <p>
              {PRACTICE_NOTICE}{" "}
              {attempt.answers_shown
                ? "You have used all your attempts, so the right answers are shown below."
                : "The right answers are shown once you have used all your attempts."}
            </p>
          </Banner>
        ) : (
          <Banner role="note" title={PRACTICE_NOTICE} tone="info">
            <p>Answer every question, then submit. You see your score and feedback at once.</p>
          </Banner>
        )}

        {submitted ? (
          <ol className="stack stack--lg" role="list">
            {attempt.items.map((item, index) => {
              const chosen = new Set(item.chosen ?? []);
              const right = new Set(item.right_options ?? []);
              return (
                <li className="card" key={item.question_id}>
                  <div className="card__header">
                    <h2 className="card__title">
                      {index + 1}. {item.prompt}
                    </h2>
                    {item.correct ? (
                      <Tag shape="check" tone="positive">
                        Right, {item.points_awarded} of {item.points}
                      </Tag>
                    ) : (
                      <Tag tone="caution">Not right, 0 of {item.points}</Tag>
                    )}
                  </div>
                  <div className="card__body stack">
                    <ul className="stack" role="list">
                      {item.options.map((option) => (
                        <li key={option.id}>
                          {option.text}
                          {chosen.has(option.id) ? <strong> (your answer)</strong> : null}
                          {right.has(option.id) ? <span className="text-small"> · right answer</span> : null}
                        </li>
                      ))}
                    </ul>
                    {item.feedback ? <p>{item.feedback}</p> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <AttemptForm attemptId={attempt.attempt_id} items={attempt.items} quizId={quizId} />
        )}
        <p>
          <TextLink href={`/learn/quizzes/${quizId}`}>Back to the quiz</TextLink>
        </p>
      </div>
    </div>
  );
}
