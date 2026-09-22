import { Block, Blocks, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Overview · Coordinating" };

// C-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinatePage() {
  return (
    <Screen
      id="C-01"
      frs="FR-604, FR-702, FR-707"
      workspace="Coordinating"
      title="Overview"
      lead="What needs attention across your cohorts."
    >
      <Blocks columns={2}>
        <Block label="Appeals awaiting action" example={{ label: "Appeals", href: "/coordinate/appeals" }} />
        <Block label="Held results by age" detail="Alert when older than the configured threshold (P-03)" />
        <Block label="Open readiness items" />
        <Block label="Headcount variances" detail="Sessions where attendance differs from catering (FR-707)" />
        <Block label="Undelivered notices" />
      </Blocks>
    </Screen>
  );
}
