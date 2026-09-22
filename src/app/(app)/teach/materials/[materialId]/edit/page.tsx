import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Edit material · Teaching" };

// F-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachMaterialsMaterialIdEditPage() {
  return (
    <Screen
      id="F-04"
      frs="FR-204"
      workspace="Teaching"
      title="Edit material"
      actions={["Publish", "Save draft", "Archive"]}
      width="form"
    >
      <Block label="State" detail="Draft, Scheduled, Published or Archived" size="sm" />
      <Form
        fields={[
          { label: "Title" },
          { label: "Module", type: "select" },
          { label: "File", type: "file" },
          { label: "Or a link", type: "url", help: "For recordings and outside resources", optional: true },
          { label: "When learners can see it", type: "radio", options: ["Publish now", "On a date"] },
          { label: "Release time", type: "datetime-local", optional: true },
        ]}
      />
    </Screen>
  );
}
