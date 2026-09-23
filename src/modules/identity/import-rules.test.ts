import { describe, expect, it } from "vitest";
import { authUserOutcome } from "./import-rules";

describe("authUserOutcome", () => {
  it("counts a new user, or one that already exists, as made", () => {
    expect(authUserOutcome(null)).toEqual({ error: null });
    expect(authUserOutcome({ code: "email_exists", status: 422, message: "exists" })).toEqual({ error: null });
    expect(
      authUserOutcome({ status: 422, message: "A user with this email address has already been registered" }),
    ).toEqual({
      error: null,
    });
  });

  it("tries rate limits, faults and lost connections again", () => {
    expect(authUserOutcome({ status: 429, message: "Too many requests" })).toEqual({
      error: "Too many requests",
      retry: true,
    });
    expect(authUserOutcome({ status: 503, message: "Unavailable" })).toMatchObject({ retry: true });
    expect(authUserOutcome({ message: "fetch failed" })).toMatchObject({ retry: true });
  });

  it("fails a row the provider refuses for good", () => {
    expect(
      authUserOutcome({ code: "validation_failed", status: 400, message: "Unable to validate email address" }),
    ).toEqual({
      error: "Unable to validate email address",
      retry: false,
    });
  });
});
