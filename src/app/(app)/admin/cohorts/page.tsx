import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Cohort archive · Administration" };

// X-10 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminCohortsPage() {
  return (
    <Screen
      id="X-10"
      frs="FR-111, FR-112"
      workspace="Administration"
      title="Cohort archive"
      lead="Archive a cohort once nothing about it is still open."
      actions={["Archive cohort"]}
    >
      <Block label="Cohorts" detail="Each cohort and whether it can be archived" size="lg" />
      <Block
        heading="What must be true first"
        label="Preconditions"
        detail="Moderation signed off, no pending or held results, every appeal window closed, no open appeal (FR-111)"
      />
    </Screen>
  );
}
