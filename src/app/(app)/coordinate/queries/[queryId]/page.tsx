import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Query · Coordinating" };

// C-10 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateQueriesQueryIdPage() {
  return (
    <Screen
      id="C-10"
      frs="FR-704"
      workspace="Coordinating"
      title="Query"
      actions={["Save"]}
      aside={
        <>
          <Block heading="History" label="Routing and status history" />
        </>
      }
      asideLabel="History"
    >
      <Form
        fields={[
          { label: "Source" },
          { label: "Programme", type: "select" },
          { label: "Owner", type: "select" },
          { label: "Status", type: "select" },
          { label: "Details", type: "textarea" },
        ]}
      />
    </Screen>
  );
}
