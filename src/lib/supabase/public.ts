import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getPublicEnvironment } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * A client with no session and no cookies, for requests that authenticate some other way: the calendar feed, whose
 * token is its credential (ADR-020). It can call only what the anon role may.
 */
export function createPublicClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } = getPublicEnvironment();
  return createClient<Database, "api">(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    db: { schema: "api" },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
