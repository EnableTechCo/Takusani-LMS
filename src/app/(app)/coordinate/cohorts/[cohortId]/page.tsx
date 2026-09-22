import { CohortNav } from "@/components/skeleton/cohort-nav";
import { Block, Blocks, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Cohort overview · Coordinating" };

// C-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCohortsCohortIdPage() {
  return (
    <Screen
      id="C-02"
      frs="FR-701"
      workspace="Coordinating"
      title="Cohort overview"
      nav={<CohortNav cohortId="example" current="Overview" />}
    >
      <Block label="Summary" detail="Programme, dates, moderation policy, enrolment count" size="sm" />
      <Blocks columns={2}>
        <Block heading="Readiness" label="Open readiness items" />
        <Block heading="Moderation" label="Moderation state" />
      </Blocks>
    </Screen>
  );
}
