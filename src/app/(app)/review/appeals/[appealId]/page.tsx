import { Block, Form, Screen, Workspace } from "@/components/skeleton/skeleton";

export const metadata = { title: "Appeal review · Appeal reviews" };

// R-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ReviewAppealsAppealIdPage() {
  return (
    <Screen
      id="R-02"
      frs="FR-609, FR-610, FR-611"
      workspace="Appeal reviews"
      title="Appeal review"
      lead="Review the grounds and the full record, then record the outcome."
      width="full"
    >
      <Workspace
        evidence={
          <>
            <Block heading="Grounds" label="The learner's grounds" />
            <Block label="Submission and evidence" size="xl" />
          </>
        }
        panel={
          <>
            <Block heading="Record" label="Marks and the chain of decisions" />
            <Block heading="Moderation" label="Moderation findings" size="sm" />
            <Form
              heading="Outcome"
              fields={[
                { label: "Outcome", type: "radio", options: ["Upheld", "Amended up", "Amended down"] },
                { label: "Reasons", type: "textarea" },
              ]}
            />
            <Block label="Remediation" detail="Required when the amended outcome is Not yet competent" size="sm" />
          </>
        }
        decision={{
          summary: "Your outcome and reasons. This decision is final for the learner (FR-613).",
          actions: ["Record outcome"],
        }}
      />
    </Screen>
  );
}
