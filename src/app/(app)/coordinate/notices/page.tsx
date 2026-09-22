import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Notices · Coordinating" };

// C-09 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateNoticesPage() {
  return (
    <Screen
      id="C-09"
      frs="FR-703"
      workspace="Coordinating"
      title="Notices"
      actions={[{ label: "New notice", href: "/coordinate/notices/new" }]}
    >
      <Block label="Notices" detail="Audience, schedule, delivery counts by state" size="xl" />
    </Screen>
  );
}
