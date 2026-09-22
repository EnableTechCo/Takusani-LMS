import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Cycles · Moderating" };

// M-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ModeratePage() {
  return (
    <Screen
      id="M-01"
      frs="FR-504"
      workspace="Moderating"
      title="Cycles"
      lead="Moderation cycles and items allocated to you."
    >
      <Block
        label="Cycles allocated to you"
        detail="Cycle, cohort, your items done of total, returns outstanding"
        size="xl"
        example={{ label: "Example cycle", href: "/moderate/cycles/example" }}
      />
    </Screen>
  );
}
