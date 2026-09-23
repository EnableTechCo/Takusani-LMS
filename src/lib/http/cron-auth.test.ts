import { describe, expect, it } from "vitest";
import { cronAuthorisation } from "./cron-auth";

const secret = "a-cron-secret-of-some-length";
const request = (authorization?: string) =>
  new Request("https://lms.example/api/internal/jobs/outbox-drain", {
    headers: authorization ? { authorization } : {},
  });

describe("cronAuthorisation", () => {
  it("accepts the bearer secret Vercel Cron sends", () => {
    expect(cronAuthorisation(request(`Bearer ${secret}`), secret)).toBe("ok");
  });

  it("denies a missing or wrong secret", () => {
    expect(cronAuthorisation(request(), secret)).toBe("denied");
    expect(cronAuthorisation(request(`Bearer ${secret}x`), secret)).toBe("denied");
    expect(cronAuthorisation(request(secret), secret)).toBe("denied");
  });

  it("accepts nothing when no secret, or a short one, is configured", () => {
    expect(cronAuthorisation(request("Bearer "), undefined)).toBe("not_configured");
    expect(cronAuthorisation(request("Bearer short"), "short")).toBe("not_configured");
  });
});
