import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Submit your work" };

// L-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnTasksTaskIdSubmitPage() {
  return (
    <Screen
      id="L-03"
      frs="FR-308, FR-309, FR-310, FR-311"
      workspace="Learning"
      title="Submit your work"
      actions={["Submit version"]}
      width="form"
    >
      <Block
        heading="1. Add files"
        label="One upload slot per evidence requirement"
        detail="Accepted types and size limit shown before choosing a file; upload progress; an interrupted upload resumes (FR-311)."
        size="lg"
      />
      <Block
        heading="2. Review"
        label="Version summary"
        detail="“This will be version 2. Version 1 stays on record.” Late notice after the due time."
      />
      <Block heading="3. Receipt" label="Submission receipt" detail="Version number, time received, files" size="sm" />
    </Screen>
  );
}
