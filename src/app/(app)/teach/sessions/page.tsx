import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Sessions · Teaching" };

// F-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachSessionsPage() {
  return (
    <Screen
      id="F-06"
      frs="FR-206, FR-207"
      workspace="Teaching"
      title="Sessions"
      lead="Scheduled sessions with their Teams links."
      actions={[{ label: "New session", href: "/teach/sessions/new" }]}
    >
      <Block
        label="Sessions"
        detail="Date, time, duration, audience, link validity"
        size="xl"
        example={{ label: "Example session", href: "/teach/sessions/example" }}
      />
    </Screen>
  );
}
