import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Materials" };

// L-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnMaterialsPage() {
  return (
    <Screen
      id="L-04"
      frs="FR-301, FR-204, FR-208"
      workspace="Learning"
      title="Materials"
      lead="Learning material and session recordings, by module."
    >
      <Form fields={[{ label: "Search materials", type: "search" }]} />
      <Block
        label="Materials and recordings by module"
        detail="Module, title, type, and size for downloads"
        size="xl"
        example={{ label: "Example material", href: "/learn/materials/example" }}
      />
    </Screen>
  );
}
