import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Session · Teaching" };

// F-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachSessionsSessionIdPage() {
  return (
    <Screen
      id="F-06"
      frs="FR-206, FR-207"
      workspace="Teaching"
      title="Session"
      actions={["Save session", "Cancel session"]}
      aside={
        <>
          <Block
            heading="Register"
            label="Attendance"
            example={{ label: "Open the register", href: "/teach/sessions/example/register" }}
          />
        </>
      }
      asideLabel="Register"
    >
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
      <Block label="Who will be notified of a change or cancellation (FR-207)" size="sm" />
    </Screen>
  );
}
