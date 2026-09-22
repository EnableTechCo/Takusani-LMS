import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Logistics · Coordinating" };

// C-11 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateLogisticsPage() {
  return (
    <Screen
      id="C-11"
      frs="FR-705, FR-706, FR-707"
      workspace="Coordinating"
      title="Logistics"
      lead="Sessions that need a venue, catering or equipment."
    >
      <Block
        label="Upcoming sessions"
        detail="Venue, headcount, arranged or not. (A list the nav needs; the UX inventory has only the per-session screen.)"
        size="xl"
        example={{ label: "Example session", href: "/coordinate/sessions/example/logistics" }}
      />
    </Screen>
  );
}
