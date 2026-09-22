"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvironment } from "@/config/env";
import type { Database } from "@/types/database";

export function createClient() {
  const environment = getPublicEnvironment();
  return createBrowserClient<Database, "api">(
    environment.NEXT_PUBLIC_SUPABASE_URL,
    environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { db: { schema: "api" } },
  );
}
