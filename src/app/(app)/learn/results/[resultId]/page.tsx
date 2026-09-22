import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Your result" };

// L-15 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnResultsResultIdPage() {
  return (
    <Screen
      id="L-15"
      frs="FR-316, FR-317, FR-603, NFR-11"
      workspace="Learning"
      title="Your result"
      actions={[{ label: "Lodge an appeal", href: "/learn/results/example/appeal/new" }]}
      aside={
        <>
          <Block
            heading="Appeal"
            label="Appeal closing day"
            detail="Days left, counting weekends and public holidays"
            size="sm"
          />
          <Block
            heading="How you were told"
            label="Notification evidence"
            detail="In-app and email, with times (NFR-11)"
          />
          <Block heading="History" label="Decision history" detail="Every decision on this item (BR-03)" />
        </>
      }
      asideLabel="Appeal, notification and history"
    >
      <Block label="Outcome" detail="Competent or Not yet competent, and when it was released" size="sm" />
      <Block
        heading="What to do next"
        label="Remediation"
        detail="What to do and the resubmission deadline, when not yet competent (FR-317)"
      />
      <Block heading="Marks" label="Marks per criterion" />
      <Block heading="Feedback" label="Assessor's feedback" size="lg" />
    </Screen>
  );
}
