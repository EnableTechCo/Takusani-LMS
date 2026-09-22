import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "My work" };

// G-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function HomePage() {
  return (
    <Screen
      id="G-04"
      frs="FR-102, FR-401, FR-409, FR-504, FR-609"
      title="My work"
      lead="Work from every workspace you hold, in one list."
    >
      <Block label="Filters" detail="Workspace and cohort" size="sm" />
      <Block
        label="Work list"
        detail="One row per work item: type, learner or cohort, due date, workspace tag. Items to mark, items returned to you, sample items to review, cycles you can sign off, appeals to review or administer, open checklist items."
        size="xl"
      />
    </Screen>
  );
}
