import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Account" };

// G-06 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AccountPage() {
  return (
    <Screen
      id="G-06"
      frs="FR-102"
      title="Account"
      lead="Your details, the roles you hold, and your preferences."
      actions={["Save"]}
      width="form"
    >
      <Block heading="Your details" label="Name and email" size="sm" />
      <Block
        heading="Roles"
        label="Roles you hold"
        detail="Each role with its scope, read-only. Roles are set by an administrator."
      />
      <Form
        heading="Password"
        fields={[
          { label: "Current password", type: "password" },
          { label: "New password", type: "password" },
        ]}
      />
      <Form
        heading="Preferences"
        fields={[
          { label: "Appearance", type: "radio", options: ["Light", "Dark", "System"] },
          { label: "Email me as well as notifying me here", type: "checkbox" },
        ]}
      />
    </Screen>
  );
}
