import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Whether a request comes from Vercel Cron: it sends `Authorization: Bearer <CRON_SECRET>`. Compared in constant time
 * (over digests, so the lengths match). With no secret configured nothing is accepted, so a missing setting never
 * leaves a job open to anyone.
 */
export function cronAuthorisation(request: Request, secret: string | undefined): "ok" | "denied" | "not_configured" {
  if (!secret || secret.length < 16) return "not_configured";
  const presented = request.headers.get("authorization") ?? "";
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(presented), digest(`Bearer ${secret}`)) ? "ok" : "denied";
}
