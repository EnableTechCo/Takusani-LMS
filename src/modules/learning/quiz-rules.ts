/** Formative quizzes (S4-13; FR-205, FR-302, FR-303): the words for scores, attempts and refusals. */

export interface QuizOption {
  id: string;
  text: string;
}

export interface QuizItem {
  question_id: string;
  prompt: string;
  kind: "single" | "multiple";
  options: QuizOption[];
  points: number;
  chosen?: string[] | null;
  correct?: boolean | null;
  points_awarded?: number | null;
  feedback?: string | null;
  right_options?: string[] | null;
}

export const PRACTICE_NOTICE = "Practice: this quiz does not count towards your result.";

export const QUIZ_REFUSALS: Record<string, string> = {
  unauthenticated: "Your session has ended. Sign in again.",
  forbidden: "You do not set work in this programme or cohort.",
  not_found: "This quiz is not available.",
  cohort_not_found: "Choose a cohort.",
  invalid_title: "Enter a title of up to 200 characters.",
  invalid_description: "The description is longer than 5,000 characters.",
  invalid_attempt_limit: "Allow from 1 to 20 attempts.",
  module_not_in_programme: "Choose a module from this programme.",
  not_a_draft: "This quiz is published, so it is fixed. Make a new quiz to change it.",
  no_questions: "Add at least one question before publishing.",
  invalid_questions: "Each question is worth from 1 to 100 points, and appears once.",
  invalid_prompt: "Write the question, up to 2,000 characters.",
  invalid_kind: "Choose whether one or several answers are right.",
  invalid_options:
    "Give 2 to 8 answers, each up to 500 characters, and mark the right one (or, for several right answers, at least one).",
  feedback_too_long: "Feedback is up to 2,000 characters.",
  in_use: "This question is in a published quiz, so its wording and answer are fixed.",
  limit_reached: "You have used all your attempts at this quiz.",
  already_submitted: "This attempt was already submitted.",
  invalid_answers: "Your answers could not be read. Try again.",
  error: "That could not be saved. Try again.",
};

/** "3 of 5" and the percentage, for a score. */
export function scoreText(score: number, max: number): string {
  const percent = max > 0 ? Math.round((100 * score) / max) : 0;
  return `${score} of ${max} (${percent}%)`;
}

/** "1 of 3 attempts used". */
export function attemptsText(used: number, limit: number): string {
  return `${used} of ${limit} ${limit === 1 ? "attempt" : "attempts"} used`;
}

/** The answers a form sends: `q:<question id>` fields, one per chosen option. */
export function answersFromForm(entries: [string, FormDataEntryValue][]): Record<string, string[]> {
  const answers: Record<string, string[]> = {};
  for (const [name, value] of entries) {
    if (!name.startsWith("q:") || typeof value !== "string") continue;
    const id = name.slice(2);
    answers[id] = [...(answers[id] ?? []), value];
  }
  return answers;
}

/** A question's options from the form: `option1`..`option8` with `correct1`.. (checkbox or the single radio). */
export function optionsFromForm(form: FormData): { text: string; correct: boolean }[] {
  const single = String(form.get("correct") ?? "");
  const options: { text: string; correct: boolean }[] = [];
  for (let index = 1; index <= 8; index += 1) {
    const text = String(form.get(`option${index}`) ?? "").trim();
    if (!text) continue;
    options.push({ text, correct: form.get(`correct${index}`) === "on" || single === String(index) });
  }
  return options;
}
