import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Tasks" };

// L-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnTasksPage() {
  return (
    <Screen
      id="L-02"
      frs="FR-308, FR-309"
      workspace="Learning"
      title="Tasks"
      lead="All your tasks and where each one stands."
    >
      <Block label="Filter chips" detail="To do, Submitted, Late, Returned" size="sm" />
      <Block
        label="Task list"
        detail="Title, due date, status tag, late tag"
        size="xl"
        example={{ label: "Example task", href: "/learn/tasks/example" }}
      />
    </Screen>
  );
}
