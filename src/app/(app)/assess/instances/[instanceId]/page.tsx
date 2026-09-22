import { Block, Screen, Workspace } from "@/components/skeleton/skeleton";

export const metadata = { title: "Marking · Assessing" };

// A-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AssessInstancesInstanceIdPage() {
  return (
    <Screen
      id="A-02"
      frs="FR-402 to FR-408, FR-410"
      workspace="Assessing"
      title="Marking"
      lead="Review the evidence, score the rubric, and decide."
      width="full"
    >
      <Workspace
        evidence={
          <>
            <Block
              label="Evidence viewer"
              detail="File tabs and a version switcher; submission time and late flag."
              size="xl"
            />
          </>
        }
        panel={
          <>
            <Block label="Panel tabs" detail="Rubric, Feedback, Integrity (exams only), History" size="sm" />
            <Block heading="Rubric" label="Mark per criterion" size="lg" />
            <Block heading="Feedback" label="Overall feedback for the learner" />
            <Block
              heading="Integrity"
              label="Integrity log and judgement"
              detail="Material or not material (FR-406, FR-407)"
            />
            <Block heading="History" label="Version and decision history" size="sm" />
          </>
        }
        decision={{
          summary: "Outcome, justification and remediation; whether the result will be held or released (FR-408).",
          actions: ["Finalise decision", "Save draft"],
        }}
      />
    </Screen>
  );
}
