import { afterEach, describe, expect, it, vi } from "vitest";
import { emailSender, type OutgoingEmail } from "./email";

const email: OutgoingEmail = {
  to: "learner@takusani.test",
  subject: "Your result for Task 3 is ready",
  text: "Hello",
  html: "<p>Hello</p>",
  idempotencyKey: "a".repeat(64),
};

const resend = emailSender({ EMAIL_PROVIDER: "resend", EMAIL_FROM: "LMS <lms@example.org>", RESEND_API_KEY: "re_x" })!;

function respond(status: number, body: unknown = {}) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

afterEach(() => vi.restoreAllMocks());

describe("emailSender", () => {
  it("is null when email is not set up", () => {
    expect(emailSender(null)).toBeNull();
  });

  it("sends through Resend with the delivery's idempotency key", async () => {
    const fetch = respond(200, { id: "re_123" });
    await expect(resend.send(email)).resolves.toEqual({ outcome: "accepted", providerMessageId: "re_123" });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init!.headers as Record<string, string>)["idempotency-key"]).toBe(email.idempotencyKey);
    expect(JSON.parse(init!.body as string)).toMatchObject({ from: "LMS <lms@example.org>", to: [email.to] });
  });

  it("retries rate limits, the provider's faults, a key still in flight and wrong credentials", async () => {
    for (const status of [429, 500, 503, 409, 401, 403]) {
      respond(status);
      await expect(resend.send(email)).resolves.toMatchObject({ outcome: "retry" });
      vi.restoreAllMocks();
    }
  });

  it("fails for good when the provider refuses the message itself", async () => {
    respond(422, { message: "Invalid to field." });
    await expect(resend.send(email)).resolves.toMatchObject({
      outcome: "failed",
      error: expect.stringContaining("422"),
    });
  });

  it("retries when the provider cannot be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(resend.send(email)).resolves.toMatchObject({
      outcome: "retry",
      error: expect.stringContaining("fetch failed"),
    });
  });

  it("sends to the local mail catcher with the sender's name and address split", async () => {
    const fetch = respond(200, { ID: "mp1" });
    const mailpit = emailSender({
      EMAIL_PROVIDER: "mailpit",
      EMAIL_FROM: "Takusani LMS <lms@takusani.test>",
      MAILPIT_URL: "http://127.0.0.1:54324",
    })!;
    await expect(mailpit.send(email)).resolves.toEqual({ outcome: "accepted", providerMessageId: "mp1" });
    expect(fetch.mock.calls[0][0]).toBe("http://127.0.0.1:54324/api/v1/send");
    expect(JSON.parse(fetch.mock.calls[0][1]!.body as string).From).toEqual({
      Email: "lms@takusani.test",
      Name: "Takusani LMS",
    });
  });
});
