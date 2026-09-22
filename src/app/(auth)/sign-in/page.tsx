import Link from "next/link";

export const metadata = { title: "Sign in" };

// Ported from docs/design/ui/prototype/sign-in.html (default state). Static shell: no data or behaviour yet.
export default function SignInPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="auth-shell">
        <header className="auth-shell__header">
          <p className="auth-shell__institution">Khanya Skills Institute</p>
          <span className="brand">
            <svg className="brand__mark" viewBox="0 0 32 32" aria-hidden="true">
              <path
                fill="currentColor"
                fillRule="evenodd"
                d="M7 0H25A7 7 0 0 1 32 7V25A7 7 0 0 1 25 32H7A7 7 0 0 1 0 25V7A7 7 0 0 1 7 0ZM7 8.5H25V12H17.75V24H14.25V12H7ZM8.25 17.5A1.75 1.75 0 1 0 11.75 17.5A1.75 1.75 0 1 0 8.25 17.5ZM20.25 17.5A1.75 1.75 0 1 0 23.75 17.5A1.75 1.75 0 1 0 20.25 17.5Z"
              />
            </svg>
            <span className="brand__name">Takusani</span>
            <span className="brand__suffix">LMS</span>
          </span>
        </header>
        <main className="auth-shell__main" id="main" tabIndex={-1}>
          {/* ===== Sign in: default, wrong details, signed out for security ===== */}
          {/* The fields have no name attribute on purpose: this static form must never put a password in a URL. */}
          <div className="auth-shell__card form">
            <h1 className="text-title">
              <span>Sign in</span>
            </h1>
            <form className="form" noValidate aria-label="Sign in">
              {/* Default and signed-out: clean fields */}
              <div className="field">
                <label className="field__label" htmlFor="email">
                  Email address
                </label>{" "}
                <input
                  className="input"
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  spellCheck="false"
                  placeholder="name@example.org"
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="password">
                  Password
                </label>{" "}
                <input className="input" id="password" type="password" autoComplete="current-password" />{" "}
                <label className="check">
                  <input className="check__input" type="checkbox" />
                  <span className="check__label">Show password</span>
                </label>
              </div>
              {/* Wrong details: the email is kept, the password is cleared. Both fields point to the one message. The message never says which of the two was wrong, and is the same for an unknown or deactivated account. */}
              <button type="submit" className="btn btn--primary btn--block">
                Sign in
              </button>
              <p className="text-small">
                <a href="#">Forgot your password?</a>
              </p>
            </form>
            {/* ===== Too many attempts: password sign-in is paused. Generic wording, so it does not confirm that an account exists. ===== */}
            {/* ===== Forgot password: ask for the email address ===== */}
            {/* ===== Password reset sent: same wording whether or not the account exists ===== */}
          </div>
        </main>
        <footer className="auth-shell__footer">
          <Link href="/">Help with signing in</Link> <span>Times are shown in South African time (SAST)</span>
          <fieldset className="fieldset">
            <legend className="u-visually-hidden">Appearance</legend>
            <div className="segmented">
              <label className="segmented__option">
                <input type="radio" name="theme-auth" value="light" data-theme-choice="" defaultChecked />
                <span>Light</span>
              </label>{" "}
              <label className="segmented__option">
                <input type="radio" name="theme-auth" value="dark" data-theme-choice="" />
                <span>Dark</span>
              </label>{" "}
              <label className="segmented__option">
                <input type="radio" name="theme-auth" value="auto" data-theme-choice="" />
                <span>System</span>
              </label>
            </div>
          </fieldset>
        </footer>
      </div>
    </>
  );
}
