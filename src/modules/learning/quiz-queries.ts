import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { QuizItem } from "./quiz-rules";

// Formative quizzes (S4-13). Facilitators read their quizzes and bank (with keys); learners read their own quizzes
// and attempts (never a key, except the right answers once their attempts are used). The database decides.

export async function listQuizzes() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_quizzes");
  if (error) throw new Error(`api.list_quizzes failed: ${error.message}`);
  return data;
}

export async function getQuiz(quizId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_quiz", { p_quiz_id: quizId });
  if (error) throw new Error(`api.get_quiz failed: ${error.message}`);
  const row = data?.[0];
  return row ? { ...row, questions: (row.questions ?? []) as unknown as (QuizItem & { correct: string[] })[] } : null;
}

export async function listQuestionBank(programmeId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_question_bank", { p_programme_id: programmeId });
  if (error) throw new Error(`api.list_question_bank failed: ${error.message}`);
  return data;
}

export async function listMyQuizzes() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_my_quizzes");
  if (error) throw new Error(`api.list_my_quizzes failed: ${error.message}`);
  return data;
}

export interface AttemptSummary {
  attempt_id: string;
  attempt_number: number;
  state: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  max_score: number | null;
}

export async function getMyQuiz(quizId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_quiz", { p_quiz_id: quizId });
  if (error) throw new Error(`api.get_my_quiz failed: ${error.message}`);
  const row = data?.[0];
  return row
    ? {
        ...row,
        questions: (row.questions ?? []) as unknown as QuizItem[],
        attempts: (row.attempts ?? []) as unknown as AttemptSummary[],
      }
    : null;
}

export async function getMyQuizAttempt(attemptId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_quiz_attempt", { p_attempt_id: attemptId });
  if (error) throw new Error(`api.get_my_quiz_attempt failed: ${error.message}`);
  const row = data?.[0];
  return row ? { ...row, items: (row.items ?? []) as unknown as QuizItem[] } : null;
}
