import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Tasks · Teaching" };

// F-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachTasksPage() {
  return (
    <Screen
      id="F-02"
      frs="FR-201, FR-202"
      workspace="Teaching"
      title="Tasks"
      lead="Drafts and published tasks."
      actions={[{ label: "New task", href: "/teach/tasks/new" }]}
    >
      <Block
        label="Tasks"
        detail="Title, state (Draft, Published), due date, audience"
        size="xl"
        example={{ label: "Example task", href: "/teach/tasks/example/edit" }}
      />
    </Screen>
  );
}
