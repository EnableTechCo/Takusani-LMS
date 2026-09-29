import { NextResponse, type NextRequest } from "next/server";
import { hasPublicEnvironment } from "@/config/env";
import { redirectUrl } from "@/lib/http/redirect-url";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/modules/identity/access";

// no_access: no active profile. idle: the app shell signed out after inactivity (A11Y-07).
const REASONS = new Set(["no_access", "idle"]);

async function signOut(request: NextRequest, reason: string | null, next: string | null = null) {
  if (hasPublicEnvironment()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const target = redirectUrl(request, "/sign-in");
  if (reason && REASONS.has(reason)) target.searchParams.set("reason", reason);
  // After an inactivity sign-out, signing in again returns to the page the person was on.
  const back = reason === "idle" ? safeNextPath(next) : null;
  if (back) target.searchParams.set("next", back);
  return NextResponse.redirect(target, { status: 303 });
}

/** The account menu's Sign out form posts here. */
export async function POST(request: NextRequest) {
  return signOut(request, null);
}

/** Used by the app shell when a session has no active profile (deactivated, or never set up), or after inactivity. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  return signOut(request, params.get("reason"), params.get("next"));
}
