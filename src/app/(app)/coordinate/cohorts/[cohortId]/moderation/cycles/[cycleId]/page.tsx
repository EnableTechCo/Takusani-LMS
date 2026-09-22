import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Cycle and sample record · Coordinating" };

// C-07 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCohortsCohortIdModerationCyclesCycleIdPage() {
  return (
    <Screen
      id="C-07"
      frs="FR-502 to FR-505"
      workspace="Coordinating"
      title="Cycle and sample record"
      actions={["Reallocate item"]}
    >
      <Block heading="Sample" label="Seed, rule version, population count and digest" />
      <Block heading="Strata" label="Strata counts and inclusion reasons" />
      <Block heading="Allocations" label="Moderator allocations with exclusions" size="lg" />
      <Block heading="Returns" label="Returned items" size="sm" />
    </Screen>
  );
}
