import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { Brand } from "@/components/shell/brand";
import { ThemeControl } from "@/components/shell/theme-control";
import { INSTITUTION } from "@/config/institution";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

/** AuthShell (UX architecture 3.1): institution, brand, one card, help and time-zone note in the footer. */
export default async function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="auth-shell">
        <header className="auth-shell__header">
          <p className="auth-shell__institution">{INSTITUTION.name}</p>
          <span className="brand">
            <Brand />
          </span>
        </header>
        <main className="auth-shell__main" id="main" tabIndex={-1}>
          <div className="auth-shell__card">{children}</div>
        </main>
        <footer className="auth-shell__footer">
          <a className="link" href={`mailto:${INSTITUTION.helpEmail}`}>
            Help with signing in
          </a>
          <span className="text-small text-muted">Times are shown in South African time (SAST).</span>
          <ThemeControl current={theme} />
        </footer>
      </div>
    </>
  );
}
