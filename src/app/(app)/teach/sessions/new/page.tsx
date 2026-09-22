import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "New session · Teaching" };

// F-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachSessionsNewPage() {
  return (
    <Screen id="F-06" frs="FR-206" workspace="Teaching" title="New session" actions={["Save session"]} width="form">
      <Form
        fields={[
          { label: "Title" },
          { label: "Date", type: "date" },
          { label: "Start time", type: "text", help: "24-hour time, SAST" },
          { label: "Duration in minutes", type: "number" },
          { label: "Audience", type: "select" },
          { label: "Teams link", type: "url", help: "Checked when you enter it (FR-206)" },
        ]}
      />
      <Block label="Who will be notified" size="sm" />
    </Screen>
  );
}
