import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Appeal · Coordinating" };

// C-12 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateAppealsAppealIdPage() {
  return (
    <Screen
      id="C-12"
      frs="FR-605, FR-606, FR-608"
      workspace="Coordinating"
      title="Appeal"
      actions={["Admit", "Allocate reviewer"]}
      aside={
        <>
          <Block heading="State" label="State and deadlines" size="sm" />
          <Block heading="Script view" label="Grant the learner a view of their marked script (FR-606)" size="sm" />
        </>
      }
      asideLabel="State and script view"
    >
      <Block heading="Grounds" label="The learner's grounds" />
      <Block heading="Evidence" label="Release and notification evidence" />
      <Block
        heading="Reviewer"
        label="Candidate reviewers"
        detail="By AS-02 tier; people who cannot review are listed with the reason (BR-02)"
        size="lg"
      />
    </Screen>
  );
}
