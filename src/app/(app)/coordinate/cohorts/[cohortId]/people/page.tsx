import { CohortNav } from "@/components/skeleton/cohort-nav";
import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "People · Coordinating" };

// C-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCohortsCohortIdPeoplePage() {
  return (
    <Screen
      id="C-04"
      frs="FR-701, FR-104, FR-105"
      workspace="Coordinating"
      title="People"
      actions={["Add person"]}
      nav={<CohortNav cohortId="example" current="People" />}
      aside={
        <>
          <Block
            heading="Conflicts"
            label="Named conflicts"
            detail="For example an assessor who would moderate their own marking (FR-105)"
          />
        </>
      }
      asideLabel="Conflicts"
    >
      <Block
        label="Roster by role"
        detail="Learners, facilitators, assessors and moderators, with each person's open allocations"
        size="xl"
      />
    </Screen>
  );
}
