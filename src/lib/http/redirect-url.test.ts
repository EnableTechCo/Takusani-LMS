import { describe, expect, it } from "vitest";
import { redirectUrl } from "./redirect-url";

describe("redirectUrl", () => {
  it("keeps the host the browser used", () => {
    const request = new Request("http://localhost:3000/auth/confirm", { headers: { host: "127.0.0.1:3000" } });
    expect(redirectUrl(request, "/learn?x=1").href).toBe("http://127.0.0.1:3000/learn?x=1");
  });

  it("uses the forwarded host and protocol behind a proxy", () => {
    const request = new Request("http://internal:3000/", {
      headers: { host: "internal:3000", "x-forwarded-host": "lms.example.org", "x-forwarded-proto": "https" },
    });
    expect(redirectUrl(request, "/sign-in").href).toBe("https://lms.example.org/sign-in");
  });
});
