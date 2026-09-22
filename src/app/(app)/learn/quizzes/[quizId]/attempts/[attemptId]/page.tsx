import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Quiz attempt" };

// L-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnQuizzesQuizIdAttemptsAttemptIdPage() {
  return (
    <Screen
      id="L-06"
      frs="FR-302"
      workspace="Learning"
      title="Quiz attempt"
      actions={["Submit answers"]}
      aside={
        <>
          <Block heading="Your score" label="Score and per-question feedback" />
        </>
      }
      asideLabel="Score"
    >
      <Block label="Questions" detail="Each question with instant feedback once answered" size="xl" />
    </Screen>
  );
}
