import type { ReactNode } from "react";
import { Brand } from "@/components/shell/brand";
import { INSTITUTION } from "@/config/institution";

/** AuthShell (UX architecture 3.1): institution, brand, one card, help and time-zone note in the footer. */
export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
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
        </footer>
      </div>
    </>
  );
}
