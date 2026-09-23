import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicEnvironment, hasPublicEnvironment } from "@/config/env";
import { redirectUrl } from "@/lib/http/redirect-url";

/**
 * Reachable without a session. Everything else sends a signed-out visitor to sign in. Scheduled jobs have no session:
 * each one checks the cron secret itself.
 */
const PUBLIC_PATHS = [
  "/sign-in",
  "/forgot-password",
  "/auth/confirm",
  "/auth/sign-out",
  "/api/health",
  "/api/internal/jobs",
];

const isPublic = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

/**
 * Refreshes the Supabase session cookie on every request (Server Components cannot write cookies), and sends
 * signed-out visitors to /sign-in with the page they wanted. This is an optimistic check only: layouts and the
 * database decide what a signed-in person may see.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Not configured (no Supabase settings on this deployment): let requests through so the sign-in page and the
  // readiness probe can say so, rather than failing every request.
  if (!hasPublicEnvironment()) return response;
  const environment = getPublicEnvironment();

  const supabase = createServerClient(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getClaims verifies the token (and refreshes it when needed); do not put code between this and createServerClient.
  const { data } = await supabase.auth.getClaims();
  const { pathname, search } = request.nextUrl;

  if (!data?.claims && !isPublic(pathname)) {
    const signIn = redirectUrl(
      request,
      pathname === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(pathname + search)}`,
    );
    const redirect = NextResponse.redirect(signIn);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  }

  return response;
}

export const config = {
  // Everything except static files and images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
