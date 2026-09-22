import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Cohorts · Coordinating" };

// C-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCohortsPage() {
  return (
    <Screen
      id="C-02"
      frs="FR-701"
      workspace="Coordinating"
      title="Cohorts"
      actions={[{ label: "New cohort", href: "/coordinate/cohorts/new" }]}
    >
      <Block
        label="Cohorts"
        detail="Dates, moderation policy, enrolment count, readiness, moderation state"
        size="xl"
        example={{ label: "Example cohort", href: "/coordinate/cohorts/example" }}
      />
    </Screen>
  );
}
