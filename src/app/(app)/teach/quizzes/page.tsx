import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Quizzes · Teaching" };

// F-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachQuizzesPage() {
  return (
    <Screen
      id="F-05"
      frs="FR-205"
      workspace="Teaching"
      title="Quizzes"
      lead="Practice quizzes. They never count towards a result."
      actions={["New quiz", { label: "Question bank", href: "/teach/question-bank" }]}
    >
      <Block
        label="Quizzes"
        detail="Title, module, state, attempt limit"
        size="xl"
        example={{ label: "Example quiz", href: "/teach/quizzes/example/edit" }}
      />
    </Screen>
  );
}
