import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Reports · Coordinating" };

// C-13 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateReportsPage() {
  return (
    <Screen id="C-13" frs="FR-708" workspace="Coordinating" title="Reports">
      <Block
        label="Report types"
        detail="Each report listed in FR-708"
        size="xl"
        example={{ label: "Example report", href: "/coordinate/reports/example" }}
      />
    </Screen>
  );
}
