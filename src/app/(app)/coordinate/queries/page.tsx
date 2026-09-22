import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Queries · Coordinating" };

// C-10 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateQueriesPage() {
  return (
    <Screen
      id="C-10"
      frs="FR-704"
      workspace="Coordinating"
      title="Queries"
      lead="Stakeholder queries, logged and tracked to closure."
      actions={["Log query"]}
    >
      <Block
        label="Queries"
        detail="Source, programme, owner, status"
        size="xl"
        example={{ label: "Example query", href: "/coordinate/queries/example" }}
      />
    </Screen>
  );
}
