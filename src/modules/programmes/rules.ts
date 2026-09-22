import { z } from "zod";

/** Programme, qualification, unit and module codes: upper case letters, digits and dashes (matches the database). */
const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,31}$/, "Use 2 to 32 capital letters, digits or dashes, for example CBA-NQF4.");

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");

export const newProgrammeSchema = z.object({
  code,
  title: z.string().trim().min(1, "Enter the programme title.").max(200, "Use 200 characters or fewer."),
  nqfLevel: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .pipe(z.number().int().min(1, "NQF levels run from 1 to 10.").max(10, "NQF levels run from 1 to 10.").optional()),
});

export const newCohortSchema = z
  .object({
    programmeId: z.string().uuid("Choose a programme."),
    name: z.string().trim().min(1, "Enter the cohort name.").max(120, "Use 120 characters or fewer."),
    startsOn: isoDate,
    endsOn: isoDate,
  })
  .refine((cohort) => cohort.endsOn >= cohort.startsOn, {
    message: "The end date must be on or after the start date.",
    path: ["endsOn"],
  });

export const enrolSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter the learner's email address, like name@example.org."),
});

export function isUuid(value: string): boolean {
  return z.string().uuid().safeParse(value).success;
}

/** Plain-language messages for the typed refusals the programme functions return. */
export const PROGRAMME_REFUSALS: Record<string, { field?: string; message: string }> = {
  forbidden: { message: "Your coordinator role does not cover this. Ask an administrator to extend it." },
  unauthenticated: { message: "Your session has ended. Sign in again." },
  invalid_code: { field: "code", message: "Use 2 to 32 capital letters, digits or dashes, for example CBA-NQF4." },
  invalid_title: { field: "title", message: "Enter the programme title." },
  invalid_nqf_level: { field: "nqfLevel", message: "NQF levels run from 1 to 10." },
  code_taken: { field: "code", message: "Another programme already uses this code." },
  programme_not_found: { field: "programmeId", message: "That programme no longer exists. Choose another." },
  invalid_name: { field: "name", message: "Enter the cohort name." },
  invalid_dates: { field: "endsOn", message: "The end date must be on or after the start date." },
  name_taken: { field: "name", message: "This programme already has a cohort with that name." },
  cohort_not_found: { message: "That cohort no longer exists." },
  cohort_archived: { message: "This cohort is archived, so no one can be enrolled." },
  account_not_found: {
    field: "email",
    message: "No account uses that email address. An administrator creates the account first.",
  },
  not_a_learner: { field: "email", message: "That account does not hold the learner role." },
  already_enrolled: { field: "email", message: "That learner is already enrolled in this cohort." },
};

export const MODERATION_POLICY_LABELS: Record<string, string> = {
  moderated: "Moderated",
  not_moderated: "Not moderated",
};
