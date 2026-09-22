import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Plan a cycle · Coordinating" };

// C-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateCohortsCohortIdModerationCyclesNewPage() {
  return (
    <Screen id="C-06" frs="FR-501" workspace="Coordinating" title="Plan a cycle" actions={["Plan cycle"]} width="form">
      <Form
        fields={[
          { label: "Scope", type: "select", help: "Which assessable items this cycle covers" },
          { label: "Start", type: "radio", options: ["When I choose", "Automatically on a date"] },
          { label: "Start date and time", type: "datetime-local", optional: true },
        ]}
      />
      <Block label="Scope overlap" detail="Refused when another open cycle already covers an item" size="sm" />
    </Screen>
  );
}
