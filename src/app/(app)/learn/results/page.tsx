import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Results" };

// L-14 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnResultsPage() {
  return (
    <Screen id="L-14" frs="FR-316" workspace="Learning" title="Results" lead="Your released results.">
      <Block
        label="Released results"
        detail="Item, outcome, released date, appeal closing day or “closed on”"
        size="xl"
        example={{ label: "Example result", href: "/learn/results/example" }}
      />
    </Screen>
  );
}
