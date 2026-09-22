import "server-only";
import { notFound } from "next/navigation";
import type { AccountSummary } from "@/components/shell/app-shell";
import { type NavigationSubject, type WorkspaceId, workspacesFor } from "./navigation";
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

/** The account menu's identity block. A placeholder until profiles exist (Sprint 1, profiles and roles). */
export async function getAccountSummary(): Promise<AccountSummary> {
  const { roles } = await getNavigationSubject();
  return {
    name: "Example user",
    email: "user@example.org",
    initials: "EU",
    details: roles.length ? roles.map((role) => role.charAt(0).toUpperCase() + role.slice(1)) : ["No roles yet"],
  };
}

/**
 * Guards a workspace's routes: a workspace the person does not hold returns 404, the convention for
 * "not visible within your scope" (SRS 5.3; UX section 3.3).
 */
export async function requireWorkspace(id: WorkspaceId): Promise<void> {
  const held = workspacesFor(await getNavigationSubject());
  if (!held.some((workspace) => workspace.id === id)) notFound();
}
