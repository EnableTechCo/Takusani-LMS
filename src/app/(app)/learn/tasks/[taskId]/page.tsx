import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Task" };

// L-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnTasksTaskIdPage() {
  return (
    <Screen
      id="L-03"
      frs="FR-308, FR-309, FR-310, FR-311, FR-317"
      workspace="Learning"
      title="Task"
      lead="Read the brief, submit your work, and see every version you have sent."
      actions={[{ label: "Submit your work", href: "/learn/tasks/example/submit" }]}
      aside={
        <>
          <Block
            heading="Versions"
            label="Version history"
            detail="Every version with its timestamp and late flag, and each receipt."
            size="lg"
          />
        </>
      }
      asideLabel="Versions"
    >
      <Block
        label="Status and due date"
        detail="Status tag and a due line, for example “Due Friday 4 September 2026 at 17:00 (SAST), in 3 days”."
        size="sm"
      />
      <Block heading="Brief" label="Task brief" size="lg" />
      <Block heading="How it is assessed" label="Assessment criteria or rubric, read-only" />
      <Block
        heading="What to submit"
        label="Evidence requirements checklist"
        detail="One item per required file, with accepted types and size limits."
      />
    </Screen>
  );
}
