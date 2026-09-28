import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnvironment, getServerEnvironment, hasServerEnvironment } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Secret-key client for the Auth admin API (creating and deleting auth users). It bypasses row-level security,
 * so use it only for Auth administration after the caller has been checked, never for application data:
 * application writes go through the signed-in person's client so the database knows who acted.
 */
export function createAdminClient() {
  const { NEXT_PUBLIC_SUPABASE_URL } = getPublicEnvironment();
  const { SUPABASE_SECRET_KEY } = getServerEnvironment();
  return createClient<Database, "api">(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY, {
    db: { schema: "api" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Secret-key client for trusted background workers (S2-10). It can call only the functions granted to
 * `service_role`, such as the notification worker's claim and settle; the database checks nothing about a person,
 * so never call it on behalf of a request without the caller having been checked.
 */
export function createWorkerClient() {
  return createAdminClient();
}

/**
 * Secret-key client for the sign-in handler's lockout counting (S3-06), which runs before anyone is signed in. Null
 * when the secret key is not set: sign-in then works without per-account counting (Supabase's per-address limits
 * still apply), and the gap is logged rather than blocking everyone from signing in.
 */
export function createLockoutClient() {
  if (!hasServerEnvironment()) {
    console.error("sign-in lockout is off: SUPABASE_SECRET_KEY is not set");
    return null;
  }
  return createAdminClient();
}
