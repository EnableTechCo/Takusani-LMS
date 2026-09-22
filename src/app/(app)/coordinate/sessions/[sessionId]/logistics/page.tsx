import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Session logistics · Coordinating" };

// C-11 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function CoordinateSessionsSessionIdLogisticsPage() {
  return (
    <Screen
      id="C-11"
      frs="FR-705, FR-706, FR-707"
      workspace="Coordinating"
      title="Session logistics"
      actions={["Mark arranged"]}
      aside={
        <>
          <Block heading="Attendance" label="Confirmed headcount, captured attendance and variance flag (FR-707)" />
        </>
      }
      asideLabel="Attendance"
    >
      <Form
        fields={[
          { label: "Venue" },
          { label: "Catering headcount", type: "number", help: "Starts from confirmed enrolment; the source is shown" },
          { label: "Dietary requirements", type: "textarea", optional: true },
          { label: "Equipment", type: "textarea", optional: true },
        ]}
      />
    </Screen>
  );
}
