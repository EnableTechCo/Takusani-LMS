import { z } from "zod";
import { landingPathFor, ROLES, workspacesFor, type NavigationSubject, type Role } from "./navigation";

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

/** The identity block of the account menu. */
export interface AccountSummary {
  name: string;
  email: string;
  initials: string;
  /** Roles held, one per line (read-only; FR-102). */
  details: string[];
}

function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Display labels for role codes, in the order given, skipping codes the application does not know. */
export function roleLabels(roles: readonly string[]): string[] {
  return roles.filter(isRole).map((role) => ROLE_LABELS[role]);
}

/** Navigation for a person. No access row, or a deactivated account, gives no workspaces. */
export function toNavigationSubject(access: MyAccess | null): NavigationSubject {
  if (!access || access.status !== "active") return { roles: [], hasReviewAllocation: false };
  return { roles: access.roles.filter(isRole), hasReviewAllocation: access.has_review_allocation };
}

/**
 * Where a person goes after signing in or opening the site (UX section 3.3): signed out to /sign-in, learner only
 * to /learn, any staff role to /home, and someone signed in with no roles yet to their account page rather than
 * back to sign-in.
 */
export function homePathFor(access: MyAccess | null): string {
  const subject = toNavigationSubject(access);
  if (access?.status === "active" && workspacesFor(subject).length === 0) return "/account";
  return landingPathFor(subject);
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
const passwordSchema = z
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
