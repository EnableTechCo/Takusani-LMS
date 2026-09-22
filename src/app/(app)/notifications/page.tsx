import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Notifications" };

// G-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function NotificationsPage() {
  return (
    <Screen
      id="G-05"
      frs="NFR-11, FR-203, FR-207, FR-511, FR-604, FR-611"
      title="Notifications"
      lead="What you were told, and when."
    >
      <Block label="Filter chips" detail="All, Results, Deadlines, Appeals, Notices, Work for me (staff)" size="sm" />
      <Block
        label="Notifications, grouped by day"
        detail="Each row: title, one-line summary, time in SAST, workspace tag for people with several roles, link to the object. Opens to “How you were told”: delivery evidence per channel, in-app and email."
        size="xl"
      />
    </Screen>
  );
}
