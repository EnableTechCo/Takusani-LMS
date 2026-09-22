import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Credits" };

// L-19 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnCreditsPage() {
  return (
    <Screen
      id="L-19"
      frs="FR-318, FR-801, FR-802, FR-803, FR-804"
      workspace="Learning"
      title="Credits"
      lead="Credits earned and still outstanding."
      aside={
        <>
          <Block
            heading="Credit history"
            label="Credit ledger"
            detail="Every entry, including adjustments (FR-804)"
            size="lg"
          />
        </>
      }
      asideLabel="Credit history"
    >
      <Block
        label="Summary"
        detail="Credits earned of required, as a sentence, with a progress bar and its text equivalent"
        size="sm"
      />
      <Block
        heading="Units"
        label="Units grouped Earned and Outstanding"
        detail="Status per unit; open a unit."
        size="lg"
      />
    </Screen>
  );
}
