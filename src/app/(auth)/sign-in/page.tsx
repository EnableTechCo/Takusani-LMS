export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-xl border bg-panel p-6 shadow-panel">
        <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">Enable Technologies</p>
        <h1 className="mt-2 font-display text-3xl">Sign in</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Authentication UI and Supabase Auth commands will be implemented as the identity vertical slice.
        </p>
      </section>
    </main>
  );
}
