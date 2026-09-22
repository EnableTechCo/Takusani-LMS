import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Result corrections · Coordinating" };

// C-14 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCorrectionsPage() {
  return (
    <Screen
      id="C-14"
      frs="BR-03, P-12"
      workspace="Coordinating"
      title="Result corrections"
      lead="Correct a released result under dual control."
      actions={["Propose correction"]}
    >
      <Block
        label="Corrections"
        detail="Current decision, proposed decision, proposer, approver, reason. A second authorised person must approve."
        size="xl"
      />
    </Screen>
  );
}
