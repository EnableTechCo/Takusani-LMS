import { Block, Form, Screen, Workspace } from "@/components/skeleton/skeleton";

export const metadata = { title: "Sample item review · Moderating" };

// M-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ModerateCyclesCycleIdItemsItemIdPage() {
  return (
    <Screen
      id="M-03"
      frs="FR-507, FR-508, FR-509"
      workspace="Moderating"
      title="Sample item review"
      lead="Everything about one decision in one view."
      width="full"
    >
      <Workspace
        evidence={
          <>
            <Block label="Submission and evidence" size="xl" />
          </>
        }
        panel={
          <>
            <Block heading="Inclusion reason" label="Why this item is in the sample" size="sm" />
            <Block heading="Assessor's marks" label="Rubric with the assessor's marks" />
            <Block heading="Decision" label="Assessor's decision and justification" />
            <Form
              heading="Your finding"
              fields={[
                { label: "Finding", type: "radio", options: ["Agree", "Disagree"] },
                { label: "Reasons", type: "textarea" },
                { label: "Required corrections, if you disagree", type: "textarea", optional: true },
                { label: "Re-mark by the end of", type: "date", optional: true },
              ]}
            />
          </>
        }
        decision={{
          summary: "Your finding; a return sends the item back to the assessor with corrections (FR-509).",
          actions: ["Record finding"],
        }}
      />
    </Screen>
  );
}
