import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Quiz" };

// L-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnQuizzesQuizIdPage() {
  return (
    <Screen
      id="L-06"
      frs="FR-302, FR-303, FR-205"
      workspace="Learning"
      title="Quiz"
      actions={["Start attempt"]}
      width="prose"
    >
      <Block label="Practice notice" detail="“Practice: does not count towards your result” (FR-303)" size="sm" />
      <Block label="Quiz summary" detail="Number of questions and attempts used of the limit (FR-205)" />
      <Block
        heading="Your attempts"
        label="Past attempts"
        detail="Score for each attempt"
        example={{ label: "Example attempt", href: "/learn/quizzes/example/attempts/example" }}
      />
    </Screen>
  );
}
