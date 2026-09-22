import { CohortNav } from "@/components/shell/cohort-nav";
import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Readiness checklist · Coordinating" };

// C-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default async function CoordinateCohortsCohortIdReadinessPage({
  params,
}: {
  params: Promise<{ cohortId: string }>;
}) {
  const { cohortId } = await params;
  return (
    <Screen
      id="C-05"
      frs="FR-702"
      workspace="Coordinating"
      title="Readiness checklist"
      actions={["Assign item"]}
      nav={<CohortNav cohortId={cohortId} current="Readiness" />}
    >
      <Block
        label="Checklist"
        detail="Category, state, assignee, due date; includes “Moderation policy confirmed”"
        size="xl"
      />
    </Screen>
  );
}
