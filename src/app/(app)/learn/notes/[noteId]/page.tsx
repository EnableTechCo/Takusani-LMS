import { Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Note" };

// L-09 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnNotesNoteIdPage() {
  return (
    <Screen
      id="L-09"
      frs="FR-306"
      workspace="Learning"
      title="Note"
      lead="Only you can see this note."
      actions={["Save"]}
      width="form"
    >
      <Form
        fields={[
          { label: "Title" },
          { label: "Note", type: "textarea" },
          { label: "Linked to", type: "select", help: "A material or session", optional: true },
        ]}
      />
    </Screen>
  );
}
