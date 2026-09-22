import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Accounts · Administration" };

// X-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminAccountsPage() {
  return (
    <Screen
      id="X-02"
      frs="FR-103, FR-106"
      workspace="Administration"
      title="Accounts"
      actions={[{ label: "New account", href: "/admin/accounts/new" }]}
    >
      <Form fields={[{ label: "Find an account", type: "search" }]} />
      <Block
        label="Accounts"
        detail="Name, email, status, roles, last sign-in"
        size="xl"
        example={{ label: "Example account", href: "/admin/accounts/example" }}
      />
    </Screen>
  );
}
