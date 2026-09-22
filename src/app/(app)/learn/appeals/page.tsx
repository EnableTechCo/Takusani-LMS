import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Appeals" };

// L-17 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnAppealsPage() {
  return (
    <Screen id="L-17" frs="FR-612" workspace="Learning" title="Appeals" lead="Track your appeals.">
      <Block
        label="Your appeals"
        detail="Reference, item, type, state, lodged date"
        size="xl"
        example={{ label: "Example appeal", href: "/learn/appeals/example" }}
      />
    </Screen>
  );
}
