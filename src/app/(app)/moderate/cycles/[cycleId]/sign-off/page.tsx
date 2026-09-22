import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Sign off and release · Moderating" };

// M-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ModerateCyclesCycleIdSignOffPage() {
  return (
    <Screen
      id="M-04"
      frs="FR-510, FR-511"
      workspace="Moderating"
      title="Sign off and release"
      actions={["Sign off and release"]}
      width="form"
    >
      <Block label="Cycle summary" detail="Scope, population, sample size, frozen date" size="sm" />
      <Block heading="Checklist" label="Sign-off checklist" />
      <Block heading="Outstanding" label="Outstanding returns and unconcluded items" />
      <Block label="Eligibility" detail="Whether you can sign, and if not, exactly why" size="sm" />
      <Block
        heading="Statement"
        label="Statement and release count"
        detail="What signing means and how many results it releases"
      />
    </Screen>
  );
}
