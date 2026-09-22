import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Send a reminder · Teaching" };

// F-10 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachSubmissionsRemindersNewPage() {
  return (
    <Screen id="F-10" frs="FR-212" workspace="Teaching" title="Send a reminder" actions={["Send"]} width="form">
      <Block label="Recipients" detail="The learners you selected" size="sm" />
      <Form
        fields={[
          { label: "Task", type: "select" },
          { label: "Message", type: "textarea" },
        ]}
      />
      <Block label="Preview" detail="The message as learners will see it. “This is logged against each learner.”" />
    </Screen>
  );
}
