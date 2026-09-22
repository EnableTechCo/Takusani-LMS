import type { z } from "zod";

/** What a server action returns to its form (useActionState). */
export interface FormState {
  /** One message for the whole form, shown in a banner. */
  message?: string;
  /** One message per field, shown beside it and in the error summary. */
  errors?: Record<string, string>;
  /** Values to put back in the fields after a refusal (never passwords). */
  values?: Record<string, string>;
  done?: boolean;
}

/** Field errors from a failed parse, first message per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
