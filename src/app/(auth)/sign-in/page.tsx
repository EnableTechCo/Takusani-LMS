import { Brand } from "@/components/shell/brand";

export const metadata = { title: "Sign in" };

// AuthShell and sign-in (G-01). The form and Supabase Auth commands arrive with the sign-in ticket.
export default function SignInPage() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to main content</a>
      <div className="flex min-h-screen flex-col items-center px-4 py-10">
        <header className="mb-8">
          <Brand />
        </header>
        <main className="w-full max-w-[26rem] rounded-md border border-border bg-surface p-6" id="main" tabIndex={-1}>
          <h1 className="font-serif text-xl tracking-tight">Sign in</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Sign-in is not available yet. Accounts are created by invitation from your programme.
          </p>
        </main>
      </div>
    </>
  );
}
