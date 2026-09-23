import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvironment } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * The signed-in person's client inside the browser. Used only where the browser must talk to Supabase directly:
 * today that is the resumable upload, which sends the file to Storage without passing it through our server
 * (ADR-007). Everything else goes through Server Actions, which run as the same person.
 */
export function createBrowserSupabase() {
  const environment = getPublicEnvironment();
  return createBrowserClient<Database, "api">(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { db: { schema: "api" } },
  );
}
