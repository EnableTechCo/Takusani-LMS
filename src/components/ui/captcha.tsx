"use client";

import Script from "next/script";
import { useEffect } from "react";

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

/**
 * CAPTCHA on the sign-in and password-reset forms (S3-06, ADR-026): Cloudflare Turnstile, which adds its token to the
 * form as `cf-turnstile-response`, and Supabase Auth checks it. Renders nothing when no site key is set. A token is
 * good for one attempt, so the widget resets whenever the form comes back with an answer (`resetKey` changes).
 */
export function Captcha({ siteKey, resetKey }: { siteKey: string | null; resetKey?: unknown }) {
  useEffect(() => {
    if (resetKey !== undefined) window.turnstile?.reset();
  }, [resetKey]);

  if (!siteKey) return null;
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} data-size="flexible" data-theme="auto" />
    </>
  );
}
