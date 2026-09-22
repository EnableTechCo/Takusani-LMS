import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { redirectUrl } from "@/lib/http/redirect-url";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/modules/identity/access";

const ALLOWED: EmailOtpType[] = ["invite", "recovery"];

/**
 * Invitation and password-reset emails link here (supabase/email). Verifying the one-time token on the server
 * signs the person in with a cookie session, then they choose a password.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "invite" ? "/accept-invite" : "/reset-password";
  const next = safeNextPath(searchParams.get("next")) ?? fallback;

  if (tokenHash && type && ALLOWED.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(redirectUrl(request, next));
  }

  return NextResponse.redirect(redirectUrl(request, "/sign-in?reason=link_expired"));
}
