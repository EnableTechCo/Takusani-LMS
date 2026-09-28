"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { createClient } from "@/lib/supabase/server";
import { answersFromForm, optionsFromForm, QUIZ_REFUSALS } from "./quiz-rules";

// Formative quizzes (S4-13; FR-205, FR-302). Every rule is the database's: who may write and take quizzes, the
// attempt limit, and the score, which only the submit function computes from the keys.

const text = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const refused = (status: string, values?: Record<string, string>): FormState => ({
  message: QUIZ_REFUSALS[status] ?? QUIZ_REFUSALS.error,
  values,
});

export async function createQuiz(_: FormState, form: FormData): Promise<FormState> {
  const values = {
    cohortId: text(form, "cohortId"),
    title: text(form, "title"),
    description: text(form, "description"),
    attemptLimit: text(form, "attemptLimit"),
  };
  if (!values.cohortId) return { errors: { cohortId: "Choose the cohort this quiz is for." }, values };
  if (!values.title) return { errors: { title: "Enter a title." }, values };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_quiz", {
    p_cohort_id: values.cohortId,
    p_title: values.title,
    p_description: values.description,
    p_attempt_limit: Number(values.attemptLimit || 3),
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    return status === "invalid_attempt_limit"
      ? { errors: { attemptLimit: QUIZ_REFUSALS[status] }, values }
      : refused(status, values);
  }
  revalidatePath("/teach/quizzes");
  redirect(`/teach/quizzes/${row!.quiz_id}/edit`);
}

/** Adds a new question to the bank and, from a quiz's page, to that quiz with its points. */
export async function saveQuestion(
  context: { programmeId: string; quizId?: string; current?: { question_id: string; points: number }[] },
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const values: Record<string, string> = {};
  for (const [name, value] of form.entries()) if (typeof value === "string") values[name] = value;
  const kind = text(form, "kind") === "multiple" ? "multiple" : "single";
  const options = optionsFromForm(form);
  if (!text(form, "prompt")) return { errors: { prompt: QUIZ_REFUSALS.invalid_prompt }, values };
  if (options.length < 2 || !options.some((option) => option.correct)) {
    return { errors: { options: QUIZ_REFUSALS.invalid_options }, values };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_question", {
    // A new question: the argument has no default, so it is sent as null rather than left out.
    p_question_id: null as unknown as string,
    p_programme_id: context.programmeId,
    p_prompt: text(form, "prompt"),
    p_kind: kind,
    p_options: options,
    p_feedback_correct: text(form, "feedbackCorrect"),
    p_feedback_incorrect: text(form, "feedbackIncorrect"),
  });
  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  if (status !== "ok") {
    if (status === "invalid_options") return { errors: { options: QUIZ_REFUSALS[status] }, values };
    if (status === "invalid_prompt") return { errors: { prompt: QUIZ_REFUSALS[status] }, values };
    return refused(status, values);
  }
  if (context.quizId) {
    const { data: quiz } = await supabase.rpc("get_quiz", { p_quiz_id: context.quizId });
    const q = quiz?.[0];
    if (q) {
      await supabase.rpc("update_quiz", {
        p_quiz_id: context.quizId,
        p_title: q.title,
        p_description: q.description,
        p_attempt_limit: q.attempt_limit,
        p_questions: [
          ...(context.current ?? []),
          { question_id: row!.question_id, points: Math.max(1, Number(text(form, "points") || 1)) },
        ],
      });
    }
    revalidatePath(`/teach/quizzes/${context.quizId}/edit`);
  }
  return { done: true };
}

/** The draft's details and which bank questions it asks, in order, with their points. */
export async function updateQuiz(quizId: string, _: FormState, form: FormData): Promise<FormState> {
  const values: Record<string, string> = {};
  for (const [name, value] of form.entries()) if (typeof value === "string") values[name] = value;
  const questions = form
    .getAll("question")
    .map((id) => String(id))
    .map((id) => ({ question_id: id, points: Math.max(1, Number(text(form, `points:${id}`) || 1)) }));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_quiz", {
    p_quiz_id: quizId,
    p_title: text(form, "title"),
    p_description: text(form, "description"),
    p_attempt_limit: Number(text(form, "attemptLimit") || 0),
    p_questions: questions,
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok") {
    if (status === "invalid_attempt_limit") return { errors: { attemptLimit: QUIZ_REFUSALS[status] }, values };
    if (status === "invalid_title") return { errors: { title: QUIZ_REFUSALS[status] }, values };
    return refused(status, values);
  }
  revalidatePath(`/teach/quizzes/${quizId}/edit`);
  revalidatePath("/teach/quizzes");
  return { done: true, values };
}

export async function publishQuiz(quizId: string): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("publish_quiz", { p_quiz_id: quizId });
  revalidatePath("/teach/quizzes");
  redirect(`/teach/quizzes/${quizId}/edit?publish=${data?.[0]?.status ?? "error"}`);
}

export async function archiveQuiz(quizId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("archive_quiz", { p_quiz_id: quizId });
  revalidatePath("/teach/quizzes");
  redirect("/teach/quizzes");
}

/** Starts (or resumes) an attempt and opens it. */
export async function startQuizAttempt(quizId: string): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_quiz_attempt", { p_quiz_id: quizId });
  const row = data?.[0];
  if (error || row?.status !== "ok") redirect(`/learn/quizzes/${quizId}?refused=${row?.status ?? "error"}`);
  redirect(`/learn/quizzes/${quizId}/attempts/${row!.attempt_id}`);
}

/** Submits the answers; the page then shows the score and feedback the database worked out. */
export async function submitQuizAttempt(
  quizId: string,
  attemptId: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_quiz_attempt", {
    p_attempt_id: attemptId,
    p_answers: answersFromForm([...form.entries()]),
  });
  const status = error ? "error" : (data?.[0]?.status ?? "error");
  if (status !== "ok" && status !== "already_submitted") return refused(status);
  revalidatePath(`/learn/quizzes/${quizId}`);
  redirect(`/learn/quizzes/${quizId}/attempts/${attemptId}?submitted=1`);
}
