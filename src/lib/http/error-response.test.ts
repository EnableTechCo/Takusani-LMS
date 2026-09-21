import { describe, expect, it } from "vitest";
import { errorResponse } from "./error-response";

describe("errorResponse", () => {
  it("uses the documented error envelope", async () => {
    const response = errorResponse(
      409,
      { code: "VERSION_CONFLICT", message: "The record changed.", retryable: true },
      "request-123",
    );

    expect(response.status).toBe(409);
    expect(response.headers.get("x-request-id")).toBe("request-123");
    await expect(response.json()).resolves.toEqual({
      code: "VERSION_CONFLICT",
      message: "The record changed.",
      request_id: "request-123",
      retryable: true,
    });
  });
});
