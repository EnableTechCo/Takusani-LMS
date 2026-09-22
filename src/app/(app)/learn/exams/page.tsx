import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Exams" };

// L-10 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnExamsPage() {
  return (
    <Screen id="L-10" frs="FR-312, FR-304" workspace="Learning" title="Exams" lead="Your upcoming and past exams.">
      <Block
        label="Exams"
        detail="Window, duration, attempts used of allowed, status"
        size="xl"
        example={{ label: "Example exam", href: "/learn/exams/example" }}
      />
    </Screen>
  );
}
