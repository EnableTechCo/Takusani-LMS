import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Configuration · Administration" };

// X-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminConfigurationPage() {
  return (
    <Screen
      id="X-06"
      frs="FR-108"
      workspace="Administration"
      title="Configuration"
      lead="Settings, their current values and scheduled changes."
    >
      <Block
        label="Settings"
        detail="Setting, current value, effective from, scheduled change"
        size="xl"
        example={{ label: "Example setting", href: "/admin/configuration/example" }}
      />
    </Screen>
  );
}
