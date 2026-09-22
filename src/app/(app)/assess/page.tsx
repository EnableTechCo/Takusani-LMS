import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Queue · Assessing" };

// A-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AssessPage() {
  return (
    <Screen
      id="A-01"
      frs="FR-401, FR-905"
      workspace="Assessing"
      title="Queue"
      lead="Your marking, within the cohorts you are assigned to."
      actions={["Open next"]}
    >
      <Block label="Filters" detail="Cohort, item and state. Flagged exam attempts come first (FR-905)." size="sm" />
      <Block
        label="Marking queue"
        detail="Learner, item, version, submitted, late, integrity flag, state"
        size="xl"
        example={{ label: "Example item", href: "/assess/instances/example" }}
      />
    </Screen>
  );
}
