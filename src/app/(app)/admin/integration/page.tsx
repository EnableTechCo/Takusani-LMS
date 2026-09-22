import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Department integration · Administration" };

// X-07 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminIntegrationPage() {
  return (
    <Screen
      id="X-07"
      frs="FR-110, FR-1002"
      workspace="Administration"
      title="Department integration"
      lead="Credentials the Department uses to read records."
      actions={["Issue credential"]}
    >
      <Block
        label="Credentials"
        detail="Credential ID, scopes, status, expiry, rotation overlap, last used"
        size="lg"
      />
      <Block
        label="Rejected requests"
        detail="Count of rejected requests (FR-1002)"
        size="sm"
        example={{ label: "API access log", href: "/admin/integration/access-log" }}
      />
    </Screen>
  );
}
