import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Notes" };

// L-09 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function LearnNotesPage() {
  return (
    <Screen
      id="L-09"
      frs="FR-306, FR-307"
      workspace="Learning"
      title="Notes"
      lead="Only you can see your notes."
      actions={["New note"]}
    >
      <Form fields={[{ label: "Search your notes", type: "search" }]} />
      <Block
        label="Note list"
        detail="Title, linked material or session, last edited"
        size="xl"
        example={{ label: "Example note", href: "/learn/notes/example" }}
      />
    </Screen>
  );
}
