import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Appeal reviews · Appeal reviews" };

// R-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ReviewAppealsPage() {
  return (
    <Screen
      id="R-01"
      frs="FR-609"
      workspace="Appeal reviews"
      title="Appeal reviews"
      lead="Remark requests allocated to you."
    >
      <Block
        label="Reviews allocated to you"
        detail="Appeal reference, learner, item, allocated date, target date"
        size="xl"
        example={{ label: "Example review", href: "/review/appeals/example" }}
      />
    </Screen>
  );
}
