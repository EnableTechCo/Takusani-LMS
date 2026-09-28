import { createHash } from "node:crypto";
import { createPublicClient } from "@/lib/supabase/public";
import { buildCalendar, type FeedEvent } from "@/modules/learning/ical";

export const dynamic = "force-dynamic";

// GET /api/calendar/feeds/{token}.ics (S3-13; FR-304; ADR-020): the learner's schedule for their calendar app. The
// token in the path is the credential, so it is never logged here; the platform's log drain redacts the path segment
// (docs/development/README.md). Private caching only, with an ETag, so a revoked feed is never served from a shared
// cache and a poll with nothing new costs no document.
export async function GET(request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const token = file.endsWith(".ics") ? file.slice(0, -4) : "";
  const client =
    request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const { data, error } = await createPublicClient().rpc("calendar_feed", {
    p_token: token,
    p_client: client ?? undefined,
  });
  const row = data?.[0];
  if (error || !row) {
    return new Response("The calendar could not be read. Try again later.\n", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "300" },
    });
  }
  if (row.status === "rate_limited") {
    return new Response("Too many requests for this calendar. Try again later.\n", {
      status: 429,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "retry-after": "900" },
    });
  }
  if (row.status !== "ok") {
    return new Response("Not found.\n", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const body = buildCalendar((row.events ?? []) as unknown as FeedEvent[], {
    appUrl: new URL(request.url).origin,
    now: new Date(),
  });
  // Weak: the document's stamp changes on every build, but its events are what the ETag stands for.
  const etag = `W/"${createHash("sha256")
    .update(JSON.stringify(row.events ?? []))
    .digest("base64url")}"`;
  const headers = {
    "content-type": "text/calendar; charset=utf-8",
    "cache-control": "private, max-age=900",
    etag,
    "content-disposition": 'inline; filename="takusani.ics"',
  };
  if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { status: 200, headers });
}
