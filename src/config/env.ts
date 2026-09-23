import { z } from "zod";

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

/** False when the Supabase settings are missing, as on a deployment whose environment variables are not set yet. */
export function hasPublicEnvironment(): boolean {
  return publicEnvironmentSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  }).success;
}

export function getPublicEnvironment() {
  return publicEnvironmentSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

/** Server-only settings. Read them only from modules that import "server-only". */
const serverEnvironmentSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1, "SUPABASE_SECRET_KEY is required to create accounts"),
});

export function getServerEnvironment() {
  return serverEnvironmentSchema.parse({ SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY });
}

/**
 * Email for notifications (S2-10). `EMAIL_PROVIDER` is "resend" on a deployment, "mailpit" locally (the Supabase
 * local stack's mail catcher), or unset, in which case emails are recorded as not sent because email is not set up.
 * The provider must honour an idempotency key (ADR-025), which Resend does.
 */
const emailSchema = z.discriminatedUnion("EMAIL_PROVIDER", [
  z.object({
    EMAIL_PROVIDER: z.literal("resend"),
    EMAIL_FROM: z.string().min(3),
    RESEND_API_KEY: z.string().min(1),
  }),
  z.object({
    EMAIL_PROVIDER: z.literal("mailpit"),
    EMAIL_FROM: z.string().min(3),
    MAILPIT_URL: z.string().url().default("http://127.0.0.1:54324"),
  }),
]);

export type EmailSettings = z.infer<typeof emailSchema>;

/** The email settings, or null when email is not set up. Throws when a provider is named but misconfigured. */
export function getEmailSettings(): EmailSettings | null {
  if (!process.env.EMAIL_PROVIDER) return null;
  return emailSchema.parse({
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    MAILPIT_URL: process.env.MAILPIT_URL || undefined,
  });
}

/** The site's own address, for links in emails. */
export function getAppUrl(): string {
  return z
    .string()
    .url()
    .parse(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
    .replace(/\/$/, "");
}
