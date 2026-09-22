import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Appeal" };

// L-17 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnAppealsAppealIdPage() {
  return (
    <Screen
      id="L-17"
      frs="FR-612, FR-613, FR-605"
      workspace="Learning"
      title="Appeal"
      aside={
        <>
          <Block
            heading="Script"
            label="Your marked script"
            detail="When the coordinator grants a view (FR-606)"
            example={{ label: "Example script", href: "/learn/appeals/example/script" }}
          />
        </>
      }
      asideLabel="Script"
    >
      <Block label="State" detail="Current state and what happens next" size="sm" />
      <Block heading="Timeline" label="Timeline of states" />
      <Block
        heading="Outcome"
        label="Outcome and reasons"
        detail="Or why the appeal could not be accepted (FR-605). States “This decision is final” (FR-613)."
      />
    </Screen>
  );
}
