import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Submissions · Teaching" };

// F-08 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachSubmissionsPage() {
  return (
    <Screen
      id="F-08"
      frs="FR-210, FR-211, FR-212"
      workspace="Teaching"
      title="Submissions"
      lead="Who has submitted, who has not, and who was late."
      actions={[{ label: "Send reminder to selected", href: "/teach/submissions/reminders/new" }, "Export CSV"]}
    >
      <Block
        label="Filters"
        detail="Cohort and task; status chips with counts (Outstanding, Submitted, Late); search by learner"
        size="sm"
      />
      <Block
        label="Submissions"
        detail="Per task and learner: Submitted, Outstanding, Late; select rows to remind"
        size="xl"
        example={{ label: "Example learner", href: "/teach/submissions/learners/example" }}
      />
      <Block label="Selection bar" detail="Appears when rows are selected" size="sm" />
    </Screen>
  );
}
