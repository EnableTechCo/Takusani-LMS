import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Cohort release status · Assessing" };

// A-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AssessCohortsPage() {
  return (
    <Screen
      id="A-03"
      frs="FR-409"
      workspace="Assessing"
      title="Cohort release status"
      lead="Which results are held, what is with the moderator, and what is released."
    >
      <Block label="Per cohort and cycle" detail="Decided, held, sampled, returned to you, released" size="xl" />
    </Screen>
  );
}
