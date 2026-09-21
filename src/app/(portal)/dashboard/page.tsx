import { MODULES } from "@/modules/manifest";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <header>
        <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">Application skeleton</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-balance lg:text-4xl">LMS workspace</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Route groups, module boundaries, Supabase clients, database tests, and delivery automation are ready for vertical-slice implementation.
        </p>
      </header>

      <section aria-labelledby="status-heading" className="mt-10 rounded-xl border bg-panel p-6 shadow-panel">
        <h2 className="text-sm font-semibold" id="status-heading">Foundation status</h2>
        <ol className="mt-5 space-y-4 border-l pl-5">
          <li>
            <p className="text-sm font-medium">Architecture baseline</p>
            <p className="mt-1 text-sm text-muted">Updated planning and ADRs are authoritative.</p>
          </li>
          <li>
            <p className="text-sm font-medium">Application housing</p>
            <p className="mt-1 text-sm text-muted">Next.js App Router and Tailwind boilerplate are in place.</p>
          </li>
          <li>
            <p className="text-sm font-medium">First vertical slice</p>
            <p className="mt-1 text-sm text-muted">Not started.</p>
          </li>
        </ol>
      </section>

      <section aria-labelledby="modules-heading" className="mt-10">
        <h2 className="font-display text-2xl" id="modules-heading">Module boundaries</h2>
        <div className="mt-5 divide-y rounded-xl border bg-panel px-5">
          {MODULES.map((module) => (
            <article className="grid gap-1 py-4 md:grid-cols-[190px_1fr]" key={module.id}>
              <h3 className="text-sm font-semibold">{module.label}</h3>
              <p className="text-sm leading-6 text-muted">{module.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
