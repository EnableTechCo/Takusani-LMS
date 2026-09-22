import { Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "New material · Teaching" };

// F-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachMaterialsNewPage() {
  return (
    <Screen
      id="F-04"
      frs="FR-204, FR-208"
      workspace="Teaching"
      title="New material"
      actions={["Publish", "Save draft"]}
      width="form"
    >
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
