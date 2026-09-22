import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Material" };

// L-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnMaterialsMaterialIdPage() {
  return (
    <Screen
      id="L-05"
      frs="FR-301, FR-306"
      workspace="Learning"
      title="Material"
      actions={["Download"]}
      aside={
        <>
          <Block
            heading="Notes"
            label="Your notes on this material"
            detail="Private; only you can see them (FR-306)."
          />
        </>
      }
      asideLabel="Notes"
    >
      <Block label="Title and description" size="sm" />
      <Block
        label="File or link"
        detail="Viewer, download or external link. Opening it is logged (FR-301)."
        size="xl"
      />
    </Screen>
  );
}
