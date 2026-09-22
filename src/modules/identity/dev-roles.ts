import { ROLES, type NavigationSubject, type Role } from "./navigation";

/** Parses LMS_DEV_ROLES, a comma-separated list of roles plus optionally "reviewer". Local development only. */
export function parseDevRoles(value: string | undefined): NavigationSubject {
  const tokens = (value ?? "")
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  const roles = ROLES.filter((role): role is Role => tokens.includes(role));
  return { roles, hasReviewAllocation: tokens.includes("reviewer") };
}
