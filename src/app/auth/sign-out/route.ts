import { NextResponse, type NextRequest } from "next/server";
import { hasPublicEnvironment } from "@/config/env";
import { redirectUrl } from "@/lib/http/redirect-url";
import { createClient } from "@/lib/supabase/server";

const REASONS = new Set(["no_access"]);

async function signOut(request: NextRequest, reason: string | null) {
  if (hasPublicEnvironment()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const target = redirectUrl(request, "/sign-in");
  if (reason && REASONS.has(reason)) target.searchParams.set("reason", reason);
  return NextResponse.redirect(target, { status: 303 });
}

/** The account menu's Sign out form posts here. */
export async function POST(request: NextRequest) {
  return signOut(request, null);
}

/** Used by the app shell when a session has no active profile (deactivated, or never set up). */
export async function GET(request: NextRequest) {
  return signOut(request, request.nextUrl.searchParams.get("reason"));
}
