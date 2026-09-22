import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "New task · Teaching" };

// F-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachTasksNewPage() {
  return (
    <Screen
      id="F-03"
      frs="FR-201, FR-202, FR-203"
      workspace="Teaching"
      title="New task"
      actions={["Publish", "Save draft"]}
      width="form"
    >
      <Form heading="Brief" prefix="brief" fields={[{ label: "Title" }, { label: "Brief", type: "textarea" }]} />
      <Block heading="Rubric" label="Rubric builder" detail="Criteria and what meets each one" />
      <Form
        heading="Submission"
        prefix="submission"
        fields={[
          { label: "Due date and time", type: "datetime-local" },
          { label: "Submission type", type: "select", options: ["File upload", "Online exam"] },
          { label: "Evidence required", type: "textarea", help: "One line per file the learner must submit" },
        ]}
      />
      <Form
        heading="Audience"
        prefix="audience"
        fields={[
          { label: "Cohort", type: "select" },
          { label: "Learners", type: "select", help: "Everyone in the cohort, or chosen learners" },
        ]}
      />
      <Block
        label="Publish confirmation"
        detail="Names who will be notified and what goes on their calendars (FR-203)"
        size="sm"
      />
    </Screen>
  );
}
