import { PageHeader } from "@/components/shell/app-shell";

export const metadata = { title: "My work" };

// Staff landing page: work from every workspace the person holds, in one list (UX section 3.3, G-04).
export default function HomePage() {
  return (
    <div className="mx-auto max-w-[75rem] px-4 py-8 md:px-8">
      <PageHeader
        title="My work"
        lead="Items to mark, items returned to you, sample items to review, and appeals to handle will be listed here."
      />
    </div>
  );
}
