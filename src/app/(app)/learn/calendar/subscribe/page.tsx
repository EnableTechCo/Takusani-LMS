import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Subscribe to your calendar" };

// L-08 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnCalendarSubscribePage() {
  return (
    <Screen
      id="L-08"
      frs="FR-304"
      workspace="Learning"
      title="Subscribe to your calendar"
      lead="See sessions and deadlines in your phone's calendar."
      actions={["Create link"]}
      width="form"
    >
      <Block
        label="What the feed contains"
        detail="Sessions, exam windows and due dates. It leaves out results and private notes."
      />
      <Block label="Feed link" detail="Shown once, with Copy. Rotate or revoke it at any time." size="sm" />
    </Screen>
  );
}
