import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Calendar" };

// L-07 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnCalendarPage() {
  return (
    <Screen
      id="L-07"
      frs="FR-304, FR-305, FR-203, FR-207"
      workspace="Learning"
      title="Calendar"
      lead="Sessions, exam windows and due dates."
      actions={[{ label: "Subscribe from your phone", href: "/learn/calendar/subscribe" }]}
    >
      <Block label="View switch" detail="Agenda (the default on phones) and month" size="sm" />
      <Block
        label="Agenda list and month grid"
        detail="Sessions, exam windows and due dates; the Teams Join link appears at session time (FR-207)."
        size="xl"
      />
    </Screen>
  );
}
