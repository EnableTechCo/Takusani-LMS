import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Roles and allocations · Administration" };

// X-04 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminAccountsProfileIdRolesPage() {
  return (
    <Screen
      id="X-04"
      frs="FR-102, FR-104, FR-105, FR-107"
      workspace="Administration"
      title="Roles and allocations"
      actions={["Add role"]}
      aside={
        <>
          <Block
            heading="Conflicts"
            label="Named conflicts"
            detail="Advised when a role is assigned, blocked at allocation (U-01)"
          />
          <Block heading="History" label="Change history" />
        </>
      }
      asideLabel="Conflicts and history"
    >
      <Block label="Person" detail="Name and status" size="sm" />
      <Block
        heading="Roles"
        label="Role assignments"
        detail="Role, scope type and name, effective from and to, assigned by"
        size="lg"
      />
      <Block
        heading="Allocations"
        label="Open allocations"
        detail="Marking items, sample items and appeal reviews, with counts and links"
      />
    </Screen>
  );
}
