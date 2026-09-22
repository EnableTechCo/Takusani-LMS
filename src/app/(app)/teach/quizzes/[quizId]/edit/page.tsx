import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Quiz builder · Teaching" };

// F-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachQuizzesQuizIdEditPage() {
  return (
    <Screen id="F-05" frs="FR-205" workspace="Teaching" title="Quiz builder" actions={["Publish quiz", "Save draft"]}>
      <Form heading="Settings" fields={[{ label: "Title" }, { label: "Attempt limit", type: "number" }]} />
      <Block
        heading="Questions"
        label="Questions"
        detail="Questions, answer keys and feedback; add from the question bank"
        size="xl"
      />
    </Screen>
  );
}
