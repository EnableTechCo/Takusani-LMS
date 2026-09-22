import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Exam setup · Teaching" };

// F-11 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachExamsExamIdEditPage() {
  return (
    <Screen
      id="F-11"
      frs="FR-201, FR-312"
      workspace="Teaching"
      title="Exam setup"
      actions={["Publish exam", "Save draft"]}
      width="form"
    >
      <Form
        heading="Window and attempts"
        fields={[
          { label: "Opens", type: "datetime-local" },
          { label: "Closes", type: "datetime-local" },
          { label: "Duration in minutes", type: "number" },
          { label: "Attempts allowed", type: "number" },
        ]}
      />
      <Block
        heading="Questions"
        label="Question manifest"
        detail="Questions from the bank, their order and marks"
        size="lg"
      />
    </Screen>
  );
}
