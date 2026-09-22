import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { AccountSummary } from "@/components/shell/app-shell";
import { hasPublicEnvironment } from "@/config/env";
import { createClient } from "@/lib/supabase/server";
import { initialsOf, isRole, ROLE_LABELS, toNavigationSubject, type MyAccess } from "./access";
import { type NavigationSubject, type WorkspaceId, workspacesFor } from "./navigation";

/**
 * The signed-in person's profile and current roles, from api.my_access(). Null when there is no session or the
 * session belongs to an auth user with no profile. Cached for the request, so layouts and pages share one call.
 */
export const getMyAccess = cache(async (): Promise<MyAccess | null> => {
  if (!hasPublicEnvironment()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return null;

  const { data, error } = await supabase.rpc("my_access");
  if (error) throw new Error(`api.my_access failed: ${error.message}`);
  return data?.[0] ?? null;
});

export async function getNavigationSubject(): Promise<NavigationSubject> {
  return toNavigationSubject(await getMyAccess());
}

/**
 * For pages inside the app shell. Signed out: to sign-in. Signed in but with no profile, or deactivated: signed
 * out, then to sign-in with a neutral message (the proxy already handles "no session").
 */
export async function requireActiveAccess(): Promise<MyAccess> {
  const access = await getMyAccess();
  if (access?.status === "active") return access;
  redirect("/auth/sign-out?reason=no_access");
}

export function toAccountSummary(access: MyAccess): AccountSummary {
  const roles = access.roles.filter(isRole).map((role) => ROLE_LABELS[role]);
  return {
    name: access.full_name,
    email: access.email,
    initials: initialsOf(access.full_name),
    details: roles.length ? roles : ["No roles yet. Ask your administrator."],
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
