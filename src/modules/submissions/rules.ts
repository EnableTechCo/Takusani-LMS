import { z } from "zod";

/** Tasks (FR-201 to FR-203): what a facilitator may write, and what each refusal from the database means. */

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  file_upload: "Files uploaded by the learner",
  text: "Written in the browser",
};

export const LATE_POLICY_LABELS: Record<string, string> = {
  accept_and_flag: "Accept late work and mark it late",
  closed_at_due: "Close submissions at the due date",
};

export const TASK_STATE_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const AUDIENCE_LABELS: Record<string, string> = {
  cohort: "Everyone in the cohort",
  named: "Named learners",
};

const title = z.string().trim().min(1, "Enter the task title.").max(200, "Use 200 characters or fewer.");
const brief = z
  .string()
  .trim()
  .min(1, "Write the brief: what the learner must do.")
  .max(20000, "Use 20 000 characters or fewer.");
const submissionType = z.enum(["file_upload", "text"], { message: "Choose how learners hand the work in." });
const latePolicy = z.enum(["accept_and_flag", "closed_at_due"], { message: "Choose what happens to late work." });

/** A local date and time from a `datetime-local` field, for example "2026-10-02T17:00". Empty means no date yet. */
const dueAt = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), "Enter a date and a time.");

export const newTaskSchema = z.object({
  cohortId: z.string().uuid("Choose a cohort."),
  title,
  brief,
  submissionType,
  dueAt,
  latePolicy,
});

export const editTaskSchema = newTaskSchema.omit({ cohortId: true });

export const criterionSchema = z.object({
  title: z.string().trim().min(1, "Give the criterion a title.").max(200, "Use 200 characters or fewer."),
  descriptor: z.string().trim().max(2000, "Use 2 000 characters or fewer.").optional(),
  points: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === "" || value === undefined ? undefined : Number(value)))
    .pipe(z.number().int().min(0, "Points cannot be negative.").max(1000, "Use 1 000 points or fewer.").optional()),
});

export const criteriaSchema = z
  .array(criterionSchema)
  .max(50, "A rubric has at most 50 criteria.")
  .describe("The rubric rows, in the order marking shows them.");

export const requirementSchema = z.object({
  title: z.string().trim().min(1, "Give the requirement a title.").max(200, "Use 200 characters or fewer."),
  guidance: z.string().trim().max(1000, "Use 1 000 characters or fewer.").optional(),
  mandatory: z.boolean().optional(),
});

export const requirementsSchema = z
  .array(requirementSchema)
  .max(20, "A task asks for at most 20 pieces of evidence.")
  .describe("What the learner must hand in, in the order the submit screen shows them.");

export const audienceSchema = z
  .object({
    audience: z.enum(["cohort", "named"], { message: "Choose who the task is for." }),
    emails: z.string().trim().optional(),
  })
  .transform((value) => ({ audience: value.audience, emails: splitEmails(value.emails ?? "") }))
  .refine((value) => value.audience === "cohort" || value.emails.length > 0, {
    message: "List at least one learner's email address, one per line.",
    path: ["emails"],
  });

/** One email address per line, or separated by commas; blanks are ignored. */
export function splitEmails(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/[\n,;]+/)
        .map((line) => line.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export function isUuid(value: string): boolean {
  return z.string().uuid().safeParse(value).success;
}

/** Plain-language messages for the typed refusals the task functions return. */
export const TASK_REFUSALS: Record<string, { field?: string; message: string }> = {
  forbidden: { message: "You do not set work in this cohort. Ask a coordinator to add you to it." },
  unauthenticated: { message: "Your session has ended. Sign in again." },
  cohort_not_found: { field: "cohortId", message: "That cohort no longer exists. Choose another." },
  cohort_archived: { field: "cohortId", message: "That cohort is archived, so no new work can be set in it." },
  task_not_found: { message: "That task no longer exists." },
  not_a_draft: {
    message:
      "This task is published, so it cannot be changed. Learners have planned around it. Set a new task instead.",
  },
  invalid_title: { field: "title", message: "Enter the task title." },
  title_taken: { field: "title", message: "This cohort already has a task with that title." },
  invalid_brief: { field: "brief", message: "Write the brief: what the learner must do." },
  invalid_submission_type: { field: "submissionType", message: "Choose how learners hand the work in." },
  invalid_late_policy: { field: "latePolicy", message: "Choose what happens to late work." },
  module_not_in_programme: { message: "That module belongs to another programme." },
  invalid_criteria: { field: "criteria", message: "The rubric could not be read. Try again." },
  invalid_criterion_title: { field: "criteria", message: "Every criterion needs a title." },
  invalid_points: { field: "criteria", message: "Points are a whole number from 0 to 1000." },
  too_many_criteria: { field: "criteria", message: "A rubric has at most 50 criteria." },
  invalid_audience: { field: "audience", message: "Choose who the task is for." },
  no_learners_named: { field: "emails", message: "List at least one learner's email address, one per line." },
  learner_not_enrolled: {
    field: "emails",
    message: "One of those learners is not enrolled in this cohort. Check the addresses, or enrol them first.",
  },
  due_date_required: { field: "dueAt", message: "Set the due date before publishing." },
  due_date_passed: { field: "dueAt", message: "That due date has passed. Choose a later one before publishing." },
  no_learners: { message: "Nobody is enrolled in this cohort yet, so there is no one to publish to." },
  already_published: { message: "This task is already published." },
  invalid_requirements: { field: "requirements", message: "The evidence list could not be read. Try again." },
  invalid_requirement_title: { field: "requirements", message: "Every piece of evidence needs a title." },
  too_many_requirements: { field: "requirements", message: "A task asks for at most 20 pieces of evidence." },
};

/** Plain-language messages for the upload refusals, in the design system's tone: say what to do instead. */
export const UPLOAD_REFUSALS: Record<string, string> = {
  forbidden: "This task is not yours to submit.",
  unauthenticated: "Your session has ended. Sign in again, then choose the file once more.",
  invalid_filename: "That file name is too long. Rename the file and choose it again.",
  invalid_checksum: "That file could not be prepared. Choose it again.",
  rate_limited: "You have uploaded a lot of files in the last hour. Try again later.",
  not_uploaded: "This file did not finish uploading. Choose it again.",
  expired: "This upload took too long and has expired. Choose the file again. Nothing was submitted.",
  too_large: "This file is larger than the limit. Save it as a PDF, or take photos at a lower quality.",
  type_not_allowed: "This kind of file is not accepted here.",
  intent_not_found: "This upload is no longer available. Choose the file again.",
  error: "This file could not be accepted. Choose it again.",
};

/** A refusal that can name real numbers, for example the size of the file the learner actually chose. */
export function uploadRefusalMessage(
  status: string,
  maxBytes: number | null,
  file: { filename: string; bytes: number },
): string {
  if (status === "too_large" && maxBytes) {
    return `This file is ${formatBytes(file.bytes)}. The limit is ${formatBytes(maxBytes)}. Save it as a PDF, or take photos at a lower quality.`;
  }
  if (status === "type_not_allowed") {
    return "This kind of file is not accepted. Hand in a PDF, a Word or Excel file, or a photo (JPG or PNG).";
  }
  return UPLOAD_REFUSALS[status] ?? UPLOAD_REFUSALS.error;
}

/** Sizes as a learner reads them, not as bytes. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}
