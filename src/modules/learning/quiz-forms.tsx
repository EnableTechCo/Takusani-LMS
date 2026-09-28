"use client";

import { useActionState, useState } from "react";
import { Checkbox, Fieldset, Radio } from "@/components/ui/choice";
import { SelectField, TextareaField, TextField } from "@/components/ui/field";
import { ErrorSummary, SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import type { FormState } from "@/lib/form-state";
import { createQuiz, saveQuestion, submitQuizAttempt, updateQuiz } from "./quiz-actions";
import type { QuizItem } from "./quiz-rules";

const initial: FormState = {};

/** F-05 new quiz: the cohort, a title and the attempt limit. Questions come next, on the quiz's page. */
export function NewQuizForm({ cohorts }: { cohorts: { id: string; label: string }[] }) {
  const [state, action] = useActionState(createQuiz, initial);
  return (
    <form action={action} className="stack" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary
        errors={state.errors}
        labels={{ cohortId: "Cohort", title: "Title", attemptLimit: "Attempts allowed" }}
      />
      <SelectField
        defaultValue={state.values?.cohortId}
        error={state.errors?.cohortId}
        label="Cohort"
        name="cohortId"
        options={cohorts.map((cohort) => ({ value: cohort.id, label: cohort.label }))}
        placeholder="Choose a cohort"
      />
      <TextField defaultValue={state.values?.title} error={state.errors?.title} label="Title" name="title" />
      <TextareaField
        defaultValue={state.values?.description}
        label="Description"
        name="description"
        optional
        rows={3}
      />
      <TextField
        defaultValue={state.values?.attemptLimit ?? "3"}
        error={state.errors?.attemptLimit}
        help="How many times a learner may try it, from 1 to 20."
        inputMode="numeric"
        label="Attempts allowed"
        name="attemptLimit"
        type="number"
      />
      <div className="cluster">
        <SubmitButton pendingLabel="Creating the draft">Create draft</SubmitButton>
      </div>
    </form>
  );
}

/**
 * A new question for the programme's bank, added to this quiz. One right answer or several; feedback for a right and
 * a wrong answer. The answer key is kept apart from the question, where no learner can read it (ADR-024).
 */
export function QuestionForm({
  programmeId,
  quizId,
  current,
}: {
  programmeId: string;
  quizId: string;
  current: { question_id: string; points: number }[];
}) {
  const [state, action] = useActionState(saveQuestion.bind(null, { programmeId, quizId, current }), initial);
  const [kind, setKind] = useState<"single" | "multiple">("single");
  const values = state.done ? {} : (state.values ?? {});
  return (
    <form action={action} className="stack" key={state.done ? "saved" : "editing"} noValidate>
      {state.done ? (
        <Banner compact role="status" title="Question added to the bank and this quiz" tone="positive" />
      ) : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ prompt: "Question", options: "Answers" }} />
      <TextareaField
        defaultValue={values.prompt}
        error={state.errors?.prompt}
        label="Question"
        name="prompt"
        rows={2}
      />
      <Fieldset legend="How many answers are right?">
        <div onChange={(event) => setKind((event.target as HTMLInputElement).value as "single" | "multiple")}>
          <Radio defaultChecked label="One" name="kind" value="single" />
          <Radio label="Several: the learner must choose all of them" name="kind" value="multiple" />
        </div>
      </Fieldset>
      <Fieldset error={state.errors?.options} legend="Answers (2 to 8), with the right ones marked">
        {Array.from({ length: 5 }, (_, index) => index + 1).map((index) => (
          <div className="cluster" key={index}>
            <TextField
              defaultValue={values[`option${index}`]}
              label={`Answer ${index}`}
              name={`option${index}`}
              optional={index > 2}
            />
            {kind === "single" ? (
              <Radio label="Right answer" name="correct" value={String(index)} />
            ) : (
              <Checkbox label="Right" name={`correct${index}`} />
            )}
          </div>
        ))}
      </Fieldset>
      <div className="form__row form__row--2">
        <TextareaField
          defaultValue={values.feedbackCorrect}
          label="Feedback for a right answer"
          name="feedbackCorrect"
          optional
          rows={2}
        />
        <TextareaField
          defaultValue={values.feedbackIncorrect}
          help="Say what the right answer is and why: the learner reads it at once."
          label="Feedback for a wrong answer"
          name="feedbackIncorrect"
          optional
          rows={2}
        />
      </div>
      <TextField defaultValue={values.points ?? "1"} inputMode="numeric" label="Points" name="points" type="number" />
      <div className="cluster">
        <SubmitButton pendingLabel="Adding">Add question</SubmitButton>
      </div>
    </form>
  );
}

/** The draft's details and which bank questions it asks, with their points. */
export function QuizSetupForm({
  quiz,
  bank,
}: {
  quiz: {
    id: string;
    title: string;
    description: string;
    attempt_limit: number;
    questions: { question_id: string; points: number }[];
  };
  bank: { id: string; prompt: string; kind: string }[];
}) {
  const [state, action] = useActionState(updateQuiz.bind(null, quiz.id), initial);
  const chosen = new Map(quiz.questions.map((question) => [question.question_id, question.points]));
  const ordered = [
    ...quiz.questions.map((question) => bank.find((item) => item.id === question.question_id)).filter(Boolean),
    ...bank.filter((item) => !chosen.has(item.id)),
  ] as { id: string; prompt: string; kind: string }[];
  return (
    <form action={action} className="stack" noValidate>
      {state.done ? <Banner compact role="status" title="Saved" tone="positive" /> : null}
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ErrorSummary errors={state.errors} labels={{ title: "Title", attemptLimit: "Attempts allowed" }} />
      <TextField defaultValue={quiz.title} error={state.errors?.title} label="Title" name="title" />
      <TextareaField defaultValue={quiz.description} label="Description" name="description" optional rows={2} />
      <TextField
        defaultValue={String(quiz.attempt_limit)}
        error={state.errors?.attemptLimit}
        inputMode="numeric"
        label="Attempts allowed"
        name="attemptLimit"
        type="number"
      />
      <Fieldset legend="Questions in this quiz, from the programme's question bank">
        {ordered.length === 0 ? (
          <p className="text-small text-muted">The bank is empty. Add a question below.</p>
        ) : (
          ordered.map((item) => (
            <div className="cluster cluster--between" key={item.id}>
              <Checkbox
                defaultChecked={chosen.has(item.id)}
                help={item.kind === "multiple" ? "Several right answers" : "One right answer"}
                label={item.prompt}
                name="question"
                value={item.id}
              />
              <TextField
                defaultValue={String(chosen.get(item.id) ?? 1)}
                inputMode="numeric"
                label="Points"
                name={`points:${item.id}`}
                type="number"
              />
            </div>
          ))
        )}
      </Fieldset>
      <div className="cluster">
        <SubmitButton pendingLabel="Saving">Save quiz</SubmitButton>
      </div>
    </form>
  );
}

/** L-06 answering: one question after another; nothing is scored until it is submitted. */
export function AttemptForm({ quizId, attemptId, items }: { quizId: string; attemptId: string; items: QuizItem[] }) {
  const [state, action] = useActionState(submitQuizAttempt.bind(null, quizId, attemptId), initial);
  return (
    <form action={action} className="stack stack--lg" noValidate>
      {state.message ? <Banner title={state.message} tone="critical" /> : null}
      <ol className="stack stack--lg" role="list">
        {items.map((item, index) => (
          <li className="card" key={item.question_id}>
            <div className="card__body">
              <Fieldset
                legend={
                  <>
                    {index + 1}. {item.prompt}{" "}
                    <span className="text-small text-muted">
                      ({item.points} {item.points === 1 ? "point" : "points"}
                      {item.kind === "multiple" ? "; choose every right answer" : ""})
                    </span>
                  </>
                }
              >
                {item.options.map((option) =>
                  item.kind === "multiple" ? (
                    <Checkbox key={option.id} label={option.text} name={`q:${item.question_id}`} value={option.id} />
                  ) : (
                    <Radio key={option.id} label={option.text} name={`q:${item.question_id}`} value={option.id} />
                  ),
                )}
              </Fieldset>
            </div>
          </li>
        ))}
      </ol>
      <div className="cluster">
        <SubmitButton pendingLabel="Marking">Submit answers</SubmitButton>
      </div>
    </form>
  );
}
