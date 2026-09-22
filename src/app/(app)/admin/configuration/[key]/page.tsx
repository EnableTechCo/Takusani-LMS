import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Setting · Administration" };

// X-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminConfigurationKeyPage() {
  return (
    <Screen
      id="X-06"
      frs="FR-108, FR-109, NFR-09"
      workspace="Administration"
      title="Setting"
      actions={["Record new value"]}
      aside={
        <>
          <Block
            heading="What a change does not affect"
            label="Decisions and cycles already made keep the value they used (NFR-09)"
            size="sm"
          />
          <Block heading="History" label="Full version history" size="lg" />
        </>
      }
      asideLabel="Effect and history"
    >
      <Block label="Current value" detail="Value, effective from, who set it" size="sm" />
      <Form
        heading="Change it"
        fields={[
          { label: "New value" },
          { label: "Effective from", type: "datetime-local" },
          { label: "Reason", type: "textarea" },
        ]}
      />
    </Screen>
  );
}
