/**
 * What an Auth admin API answer means for one import row (S2-01). An email that already has an auth user counts as
 * made: the database then decides, by email, whether that is the user an earlier attempt created (imported) or someone
 * else's account (already exists). Rate limits, the provider's own faults and lost connections are tried again; any
 * other refusal fails the row with the provider's reason.
 */
export function authUserOutcome(error: { code?: string; status?: number; message: string } | null): {
  error: string | null;
  retry?: boolean;
} {
  if (!error) return { error: null };
  if (error.code === "email_exists" || /already (been )?registered/i.test(error.message)) return { error: null };
  const transient = !error.status || error.status === 429 || error.status >= 500;
  return { error: error.message.slice(0, 300), retry: transient };
}
