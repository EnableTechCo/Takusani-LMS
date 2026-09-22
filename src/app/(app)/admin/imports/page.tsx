import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Imports · Administration" };

// X-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminImportsPage() {
  return (
    <Screen
      id="X-05"
      frs="FR-103"
      workspace="Administration"
      title="Imports"
      lead="Bulk import of an intake."
      actions={[{ label: "New import", href: "/admin/imports/new" }]}
    >
      <Block
        label="Imports"
        detail="File, rows by outcome, invitation progress, started by"
        size="xl"
        example={{ label: "Example import", href: "/admin/imports/example" }}
      />
    </Screen>
  );
}
