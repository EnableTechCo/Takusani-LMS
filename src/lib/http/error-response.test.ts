import { describe, expect, it } from "vitest";
import { errorResponse } from "./error-response";

describe("errorResponse", () => {
  it("wraps the error in the documented envelope", async () => {
    const response = errorResponse(
      409,
      {
        code: "state_conflict",
        message: "The exam attempt has already been submitted.",
        retryable: false,
        details: { current_state: "submitted" },
      },
      "request-123",
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("x-request-id")).toBe("request-123");
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "state_conflict",
        message: "The exam attempt has already been submitted.",
        request_id: "request-123",
        retryable: false,
        details: { current_state: "submitted" },
      },
    });
  });

  it("rejects codes that are not lower snake_case", () => {
    expect(() => errorResponse(409, { code: "VERSION_CONFLICT", message: "x", retryable: true })).toThrow(/snake_case/);
  });
});
