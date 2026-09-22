import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Your marked script" };

// L-18 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnAppealsAppealIdScriptPage() {
  return (
    <Screen
      id="L-18"
      frs="FR-606, FR-607"
      workspace="Learning"
      title="Your marked script"
      actions={["Ask for a remark"]}
      aside={
        <>
          <Block heading="Marks" label="Marks and feedback per criterion" />
          <Block heading="Appeal window" label="Time left to appeal" size="sm" />
        </>
      }
      asideLabel="Marks and appeal window"
    >
      <Block label="Your submission" detail="Files as submitted" size="xl" />
    </Screen>
  );
}
