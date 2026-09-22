import { Block, Blocks, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Appeals · Coordinating" };

// C-12 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateAppealsPage() {
  return (
    <Screen
      id="C-12"
      frs="FR-604"
      workspace="Coordinating"
      title="Appeals"
      lead="Decide admissibility and allocate reviewers."
    >
      <Blocks columns={3}>
        <Block label="Need your action" size="sm" />
        <Block label="Oldest without a reviewer" size="sm" />
        <Block label="With a reviewer" size="sm" />
      </Blocks>
      <Block
        label="Appeals queue"
        detail="By state and age: learner, appeal, item, state"
        size="xl"
        example={{ label: "Example appeal", href: "/coordinate/appeals/example" }}
      />
    </Screen>
  );
}
