import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "New import · Administration" };

// X-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminImportsNewPage() {
  return (
    <Screen id="X-05" frs="FR-103" workspace="Administration" title="New import" actions={["Check file"]} width="form">
      <Form
        fields={[
          { label: "File", type: "file", help: "CSV. The template lists the columns." },
          { label: "Cohort", type: "select" },
        ]}
      />
      <Block
        label="Duplicate file"
        detail="Warns when the same file was imported before; importing again is safe"
        size="sm"
      />
    </Screen>
  );
}
