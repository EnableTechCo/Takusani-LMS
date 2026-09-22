import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Register · Teaching" };

// F-07 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function TeachSessionsSessionIdRegisterPage() {
  return (
    <Screen
      id="F-07"
      frs="FR-209"
      workspace="Teaching"
      title="Register"
      actions={["Save register"]}
      aside={
        <>
          <Block heading="Changes" label="Amendment log" detail="Every change after saving, with its reason (FR-209)" />
        </>
      }
      asideLabel="Changes"
    >
      <Block label="Roster" detail="Each learner: present or absent" size="xl" />
    </Screen>
  );
}
