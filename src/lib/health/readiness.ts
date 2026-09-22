import { publicEnvironmentSchema } from "@/config/env";

export type CheckState = "ok" | "failed";

export interface Readiness {
  ok: boolean;
  checks: { configuration: CheckState; database: CheckState };
}

/** Upper bound for the database probe, so a slow dependency cannot hold the check open. */
export const PROBE_TIMEOUT_MS = 2000;

/**
 * Configuration is valid, and the database answers `api.health_check()` through the Data API within the timeout.
 * The probe uses the publishable key, so it also proves the one function granted to `anon` is reachable.
 */
export async function checkReadiness(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<Readiness> {
  const parsed = publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) return { ok: false, checks: { configuration: "failed", database: "failed" } };

  const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key } = parsed.data;
  let database: CheckState = "failed";
  try {
    const response = await fetchImpl(`${url}/rest/v1/rpc/health_check`, {
      method: "POST",
      headers: {
        apikey: key,
        "content-type": "application/json",
        "content-profile": "api",
        accept: "application/json",
      },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    if (response.ok && (await response.json()) === true) database = "ok";
  } catch {
    database = "failed";
  }

  return { ok: database === "ok", checks: { configuration: "ok", database } };
}
