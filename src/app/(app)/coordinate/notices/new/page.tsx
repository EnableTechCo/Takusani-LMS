import { Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "New notice · Coordinating" };

// C-09 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateNoticesNewPage() {
  return (
    <Screen id="C-09" frs="FR-703" workspace="Coordinating" title="New notice" actions={["Send notice"]} width="form">
      <Form
        fields={[
          { label: "Audience", type: "select", options: ["A cohort", "A role group", "Everyone"] },
          { label: "Subject" },
          { label: "Message", type: "textarea" },
          { label: "When", type: "radio", options: ["Send now", "Schedule"] },
          { label: "Send at", type: "datetime-local", optional: true },
        ]}
      />
    </Screen>
  );
}
