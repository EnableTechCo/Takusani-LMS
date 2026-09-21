import "server-only";
import type { NavigationSubject } from "./navigation";
import { parseDevRoles } from "./dev-roles";

/**
 * The signed-in person's roles and appeal-review allocation.
 *
 * Until the identity slice lands (Sprint 1 tickets: profiles and roles, navigation by role), this reads
 * LMS_DEV_ROLES so the shell can be exercised locally. It fails closed: production builds always get no roles.
 */
export async function getNavigationSubject(): Promise<NavigationSubject> {
  if (process.env.NODE_ENV === "production") return { roles: [], hasReviewAllocation: false };
  return parseDevRoles(process.env.LMS_DEV_ROLES);
}
