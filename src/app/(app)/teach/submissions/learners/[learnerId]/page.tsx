import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Learner submission history · Teaching" };

// F-09 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachSubmissionsLearnersLearnerIdPage() {
  return (
    <Screen
      id="F-09"
      frs="FR-210"
      workspace="Teaching"
      title="Learner submission history"
      actions={[{ label: "Send reminder", href: "/teach/submissions/reminders/new" }]}
      aside={
        <>
          <Block heading="Reminders" label="Reminders sent" />
        </>
      }
      asideLabel="Reminders"
    >
      <Block label="Learner" detail="Name, learner number, cohort" size="sm" />
      <Block heading="Tasks" label="Every task, version, timestamp and late flag" size="xl" />
    </Screen>
  );
}
