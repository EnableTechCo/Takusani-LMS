import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Spike X-3 (S5-01; ADR-023, ADR-027), throwaway: the path a real autosave will take. The browser's session cookie
 * passes the proxy (which verifies it), this handler verifies the claims locally, and the batch goes to the database
 * in one round trip. Server-Timing reports the claim check and the database call, so the load test can tell network
 * time from server time. Only the test accounts reach the database function.
 */

/** No database: the same path without the round trip, for the baseline. */
export async function GET() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    attemptId?: string;
    leaseId?: string;
    answers?: unknown[];
  } | null;
  if (!body?.attemptId || !body.leaseId || !Array.isArray(body.answers)) {
    return NextResponse.json({ status: "invalid_request" }, { status: 400 });
  }

  const supabase = await createClient();
  const authStart = performance.now();
  const { data: claims } = await supabase.auth.getClaims();
  const authMs = performance.now() - authStart;
  if (!claims?.claims) return NextResponse.json({ status: "unauthenticated" }, { status: 401 });

  const dbStart = performance.now();
  const { data, error } = await supabase.rpc("spike_autosave", {
    p_attempt_id: body.attemptId,
    p_lease_id: body.leaseId,
    p_answers: body.answers as never,
  });
  const dbMs = performance.now() - dbStart;

  const row = data?.[0];
  const status = error ? "error" : (row?.status ?? "error");
  return NextResponse.json(
    { status, saved: row?.saved ?? 0 },
    {
      status: status === "ok" ? 200 : status === "error" ? 500 : 409,
      headers: { "server-timing": `auth;dur=${authMs.toFixed(1)}, db;dur=${dbMs.toFixed(1)}` },
    },
  );
}
