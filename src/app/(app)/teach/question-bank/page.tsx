import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Question bank · Teaching" };

// F-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachQuestionBankPage() {
  return (
    <Screen id="F-05" frs="FR-205" workspace="Teaching" title="Question bank" actions={["New question"]}>
      <Form fields={[{ label: "Search questions", type: "search" }]} />
      <Block label="Questions" detail="Question, type, module, and the quizzes that use it" size="xl" />
    </Screen>
  );
}
