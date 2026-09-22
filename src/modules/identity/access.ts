import { z } from "zod";
import { ROLES, type NavigationSubject, type Role } from "./navigation";

export const ROLE_LABELS: Record<Role, string> = {
  learner: "Learner",
  facilitator: "Facilitator",
  assessor: "Assessor",
  moderator: "Moderator",
  coordinator: "Coordinator",
  administrator: "Administrator",
};

/** The row api.my_access() returns for the signed-in person. */
export interface MyAccess {
  profile_id: string;
  full_name: string;
  email: string;
  status: string;
  roles: string[];
  has_review_allocation: boolean;
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Navigation for a person. No access row, or a deactivated account, gives no workspaces. */
export function toNavigationSubject(access: MyAccess | null): NavigationSubject {
  if (!access || access.status !== "active") return { roles: [], hasReviewAllocation: false };
  return { roles: access.roles.filter(isRole), hasReviewAllocation: access.has_review_allocation };
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? "?").slice(0, 2);
  return letters.toUpperCase();
}

const hasControlCharacter = (value: string) => [...value].some((character) => character.charCodeAt(0) < 32);

/**
 * A post-sign-in destination taken from the query string. Only same-site paths are allowed, so a crafted link
 * cannot send someone to another site after they sign in.
 */
export function safeNextPath(next: unknown): string | null {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  if (hasControlCharacter(next)) return null;
  return next;
}

/** Matches minimum_password_length in supabase/config.toml. 72 bytes is bcrypt's limit. */
export const PASSWORD_MIN = 12;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Use 72 characters or fewer.");

const email = z.string().trim().toLowerCase().email("Enter an email address, like name@example.org.");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const emailSchema = z.object({ email });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((value) => value.password === value.confirm, {
    message: "The two passwords do not match.",
    path: ["confirm"],
  });

export const newAccountSchema = z.object({
  fullName: z.string().trim().min(1, "Enter the person's full name.").max(200, "Use 200 characters or fewer."),
  email,
  role: z.enum(ROLES, { message: "Choose a role." }),
  learnerNumber: z
    .string()
    .trim()
    .max(50, "Use 50 characters or fewer.")
    .optional()
    .transform((value) => value || undefined),
});

/** Field errors from a failed parse, first message per field, for the form to show beside each field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
