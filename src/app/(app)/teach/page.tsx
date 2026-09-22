import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Overview · Teaching" };

// F-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachPage() {
  return (
    <Screen
      id="F-01"
      frs="FR-210"
      workspace="Teaching"
      title="Overview"
      lead="Today's sessions and the work still outstanding."
    >
      <Block heading="Today" label="Today's sessions" detail="Time, audience, Join and register" />
      <Block
        heading="Outstanding work"
        label="Tasks with outstanding work"
        detail="Per task: submitted, outstanding and late counts (FR-210)"
        size="lg"
        example={{ label: "Submissions", href: "/teach/submissions" }}
      />
    </Screen>
  );
}
