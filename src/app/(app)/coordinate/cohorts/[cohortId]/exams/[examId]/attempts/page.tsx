import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Exam attempts · Coordinating" };

// C-08 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCohortsCohortIdExamsExamIdAttemptsPage() {
  return (
    <Screen id="C-08" frs="FR-314, NFR-07" workspace="Coordinating" title="Exam attempts" actions={["Void attempt"]}>
      <Block
        label="Attempts"
        detail="State, how it was submitted, last save time, answers received in the grace period, void reason. Void and regrant after a sustained outage (P-13)."
        size="xl"
      />
    </Screen>
  );
}
