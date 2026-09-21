import type { ReactNode } from "react";
import Link from "next/link";

const navigation = [
  ["Dashboard", "/dashboard"],
  ["Learning", "/learning"],
  ["Assessment", "/assessment"],
  ["Moderation", "/moderation"],
  ["Appeals", "/appeals"],
  ["Reports", "/reports"],
] as const;

export default function PortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="border-b bg-panel px-5 py-4 lg:min-h-screen lg:border-r lg:border-b-0 lg:px-4 lg:py-6">
        <Link className="flex min-h-11 items-center gap-3 font-semibold" href="/dashboard">
          <span className="grid size-9 place-items-center rounded-md bg-brand text-sm text-white">ET</span>
          <span>LMS</span>
        </Link>
        <nav aria-label="Primary" className="mt-6 hidden lg:block">
          <ul className="space-y-1">
            {navigation.map(([label, href]) => (
              <li key={href}>
                <Link className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-brand" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-16 items-center justify-between border-b bg-panel px-5 lg:px-8">
          <span className="text-sm text-muted">Academic operations</span>
          <Link className="rounded-md px-3 py-2 text-sm font-medium hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand" href="/sign-in">
            Account
          </Link>
        </header>
        {children}
      </div>
    </div>
  );
}
