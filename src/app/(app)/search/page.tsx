import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Search" };

// G-07 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function SearchPage() {
  return (
    <Screen
      id="G-07"
      frs="FR-301"
      title="Search"
      lead="Find materials, tasks, sessions and exams within your own scope."
    >
      <Form fields={[{ label: "Search", type: "search" }]} />
      <Block
        label="Grouped results"
        detail="Learners: materials, recordings, tasks, sessions and exams. Staff: records within their scope. Private notes are searched only inside Notes."
        size="lg"
      />
    </Screen>
  );
}
