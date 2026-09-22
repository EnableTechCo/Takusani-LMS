import { Block, Form, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Account · Administration" };

// X-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminAccountsProfileIdPage() {
  return (
    <Screen
      id="X-03"
      frs="FR-103, FR-106, FR-107"
      workspace="Administration"
      title="Account"
      actions={["Save", "Unlock", "Send reset link", "Deactivate"]}
      aside={
        <>
          <Block
            heading="Roles"
            label="Roles and scopes"
            example={{ label: "Roles and allocations", href: "/admin/accounts/example/roles" }}
          />
          <Block heading="History" label="Change history (FR-107)" />
        </>
      }
      asideLabel="Roles and history"
    >
      <Block label="Status" detail="Active or deactivated; whether password sign-in is paused" size="sm" />
      <Form heading="Details" fields={[{ label: "Full name" }, { label: "Email address", type: "email" }]} />
    </Screen>
  );
}
