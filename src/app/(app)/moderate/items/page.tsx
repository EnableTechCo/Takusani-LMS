import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "My sample items · Moderating" };

// M-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ModerateItemsPage() {
  return (
    <Screen
      id="M-01"
      frs="FR-504"
      workspace="Moderating"
      title="My sample items"
      lead="Sample items allocated to you, across cycles."
    >
      <Block
        label="Sample items"
        detail="Item, learner, cycle, state. (Not a separate screen in the UX inventory; the nav links here.)"
        size="xl"
        example={{ label: "Example item", href: "/moderate/cycles/example/items/example" }}
      />
    </Screen>
  );
}
