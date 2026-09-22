import { CohortNav } from "@/components/shell/cohort-nav";
import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Moderation planning · Coordinating" };

// C-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default async function CoordinateCohortsCohortIdModerationPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  return (
    <Screen
      id="C-06"
      frs="FR-501, FR-506"
      workspace="Coordinating"
      title="Moderation planning"
      actions={[{ label: "Plan a cycle", href: "/coordinate/cohorts/example/moderation/cycles/new" }]}
      nav={<CohortNav cohortId={cohortId} current="Moderation" />}
    >
      <Block
        heading="Decided and waiting for a cycle"
        label="Pending pool"
        detail="Per assessable item: held results not yet in a cycle and the age of the oldest; an alert past the configured threshold (P-03)."
        size="lg"
      />
      <Block
        heading="Cycles"
        label="Cycles by state"
        detail="Planned, sampled, in review, signed off; Freeze and sample"
        example={{ label: "Example cycle", href: "/coordinate/cohorts/example/moderation/cycles/example" }}
      />
    </Screen>
  );
}
