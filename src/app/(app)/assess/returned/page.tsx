import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Returned to me · Assessing" };

// A-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AssessReturnedPage() {
  return (
    <Screen
      id="A-04"
      frs="FR-410, FR-509"
      workspace="Assessing"
      title="Returned to me"
      lead="Items a moderator sent back, with what to correct."
    >
      <Block
        label="Returned items"
        detail="Moderator's required corrections, deadline, original decision; Re-mark"
        size="xl"
        example={{ label: "Example item", href: "/assess/instances/example" }}
      />
    </Screen>
  );
}
