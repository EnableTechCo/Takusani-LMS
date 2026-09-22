import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Materials · Teaching" };

// F-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachMaterialsPage() {
  return (
    <Screen
      id="F-04"
      frs="FR-204, FR-208"
      workspace="Teaching"
      title="Materials"
      lead="Material and recordings you have added."
      actions={[{ label: "New material", href: "/teach/materials/new" }]}
    >
      <Block label="State filter" detail="Draft, Scheduled, Published, Archived" size="sm" />
      <Block
        label="Materials"
        detail="Title, module, state, release time"
        size="xl"
        example={{ label: "Example material", href: "/teach/materials/example/edit" }}
      />
    </Screen>
  );
}
