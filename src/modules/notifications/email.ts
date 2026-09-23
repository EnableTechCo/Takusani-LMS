import type { EmailSettings } from "@/config/env";

/**
 * Sending one email (S2-10). Each send carries the delivery's idempotency key, so a repeat after a crash or an
 * overlapping run is not a second email (ADR-025). The outcome says what the worker records:
 *   accepted: the provider took it.
 *   retry: try again later (timeouts, rate limits, the provider's own faults, and credentials that are wrong until
 *     someone fixes them: nothing is lost while they are).
 *   failed: the provider refused this message for good, for example an invalid address.
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}

export type SendOutcome =
  | { outcome: "accepted"; providerMessageId: string | null }
  | { outcome: "retry"; error: string }
  | { outcome: "failed"; error: string };

export interface EmailSender {
  provider: string;
  send(email: OutgoingEmail): Promise<SendOutcome>;
}

const TIMEOUT_MS = 10_000;

/** 408, 409 (the same idempotency key still in flight), 429 and 5xx pass; so do 401 and 403, a setup fault. */
function isTransient(status: number): boolean {
  return status === 401 || status === 403 || status === 408 || status === 409 || status === 429 || status >= 500;
}

async function describe(response: Response): Promise<string> {
  const body = await response.text().catch(() => "");
  return `${response.status} ${body}`.trim().slice(0, 500);
}

async function post(url: string, init: RequestInit, readId: (body: unknown) => string | null): Promise<SendOutcome> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, method: "POST", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    return { outcome: "retry", error: `could not reach the provider: ${(error as Error).message}`.slice(0, 500) };
  }
  if (response.ok) {
    const body = await response.json().catch(() => null);
    return { outcome: "accepted", providerMessageId: readId(body) };
  }
  const error = await describe(response);
  return isTransient(response.status) ? { outcome: "retry", error } : { outcome: "failed", error };
}

function resend(settings: Extract<EmailSettings, { EMAIL_PROVIDER: "resend" }>): EmailSender {
  return {
    provider: "resend",
    send: (email) =>
      post(
        "https://api.resend.com/emails",
        {
          headers: {
            authorization: `Bearer ${settings.RESEND_API_KEY}`,
            "content-type": "application/json",
            "idempotency-key": email.idempotencyKey,
          },
          body: JSON.stringify({
            from: settings.EMAIL_FROM,
            to: [email.to],
            subject: email.subject,
            text: email.text,
            html: email.html,
          }),
        },
        (body) => ((body as { id?: unknown } | null)?.id as string | undefined) ?? null,
      ),
  };
}

/** Local only: the Supabase local stack's mail catcher. It has no idempotency key; nothing leaves the machine. */
function mailpit(settings: Extract<EmailSettings, { EMAIL_PROVIDER: "mailpit" }>): EmailSender {
  const from = /^(?:(.*?)\s*<)?([^<>\s]+@[^<>\s]+)>?$/.exec(settings.EMAIL_FROM);
  return {
    provider: "mailpit",
    send: (email) =>
      post(
        `${settings.MAILPIT_URL.replace(/\/$/, "")}/api/v1/send`,
        {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            From: { Email: from?.[2] ?? settings.EMAIL_FROM, Name: from?.[1] ?? "" },
            To: [{ Email: email.to }],
            Subject: email.subject,
            Text: email.text,
            HTML: email.html,
            Headers: { "Idempotency-Key": email.idempotencyKey },
          }),
        },
        (body) => ((body as { ID?: unknown } | null)?.ID as string | undefined) ?? null,
      ),
  };
}

/** The sender for these settings, or null when email is not set up. */
export function emailSender(settings: EmailSettings | null): EmailSender | null {
  if (!settings) return null;
  return settings.EMAIL_PROVIDER === "resend" ? resend(settings) : mailpit(settings);
}
