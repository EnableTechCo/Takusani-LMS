import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Report · Coordinating" };

// C-13 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateReportsReportTypePage() {
  return (
    <Screen id="C-13" frs="FR-708" workspace="Coordinating" title="Report" actions={["Export"]}>
      <Form
        heading="Scope"
        fields={[
          { label: "Programme", type: "select" },
          { label: "Cohort", type: "select", optional: true },
          { label: "From", type: "date" },
          { label: "To", type: "date" },
        ]}
      />
      <Block label="Export status" detail="Exports run in the background: queued, then ready to download" size="sm" />
      <Block label="Report preview" size="lg" />
    </Screen>
  );
}
