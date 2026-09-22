import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "New account · Administration" };

// X-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminAccountsNewPage() {
  return (
    <Screen
      id="X-02"
      frs="FR-103"
      workspace="Administration"
      title="New account"
      actions={["Create and invite"]}
      width="form"
    >
      <Form
        fields={[
          { label: "Full name" },
          { label: "Email address", type: "email" },
          { label: "Role", type: "select" },
          { label: "Scope", type: "select" },
        ]}
      />
      <Block label="Invitation" detail="The person is emailed a link to set their password" size="sm" />
    </Screen>
  );
}
