import { notFound } from "next/navigation";

const sections = {
  learning: "Learning",
  assessment: "Assessment",
  moderation: "Moderation",
  appeals: "Appeals",
  reports: "Reports",
} as const;

type Section = keyof typeof sections;

export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;

  if (!(section in sections)) {
    notFound();
  }

  const title = sections[section as Section];

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
      <p className="text-xs font-semibold tracking-[0.14em] text-brand uppercase">Module placeholder</p>
      <h1 className="mt-2 font-display text-3xl tracking-tight">{title}</h1>
      <p className="mt-3 text-sm text-muted">This route is reserved for its first vertical slice.</p>
    </main>
  );
}
