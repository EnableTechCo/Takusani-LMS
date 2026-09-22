import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Appeal your result" };

// L-16 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnResultsResultIdAppealNewPage() {
  return (
    <Screen
      id="L-16"
      frs="FR-601, FR-602, FR-603, FR-604"
      workspace="Learning"
      title="Appeal your result"
      actions={["Lodge appeal"]}
      width="form"
    >
      <Block label="Result summary" detail="Outcome and appeal closing day, repeated" size="sm" />
      <Form
        heading="Type of appeal"
        prefix="type"
        fields={[
          {
            label: "What do you want to happen?",
            type: "radio",
            options: ["Ask for my work to be marked again", "See my work with the marks"],
          },
        ]}
      />
      <Form
        heading="Your reasons"
        prefix="grounds"
        fields={[{ label: "Why do you think the mark does not match the work you submitted?", type: "textarea" }]}
      />
      <Block
        label="Before you lodge"
        detail="Remark warning (AS-04), one-remark rule, time left in the window, and when to expect a reply."
        size="sm"
      />
    </Screen>
  );
}
