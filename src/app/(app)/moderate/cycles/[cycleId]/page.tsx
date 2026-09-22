import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Cycle · Moderating" };

// M-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ModerateCyclesCycleIdPage() {
  return (
    <Screen
      id="M-02"
      frs="FR-508, FR-510"
      workspace="Moderating"
      title="Cycle"
      actions={[{ label: "Open next item", href: "/moderate/cycles/example/items/example" }]}
      aside={
        <>
          <Block
            heading="Sign-off"
            label="Sign-off readiness"
            example={{ label: "Sign off", href: "/moderate/cycles/example/sign-off" }}
          />
        </>
      }
      asideLabel="Sign-off"
    >
      <Block label="Progress" detail="Items by state; returns outstanding" size="sm" />
      <Block heading="Sample items" label="Item list" detail="Item, learner, inclusion reason, state" size="lg" />
      <Block heading="Observations" label="Cohort-level observations editor (FR-508)" />
    </Screen>
  );
}
