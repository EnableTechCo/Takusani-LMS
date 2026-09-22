import { Block, Blocks, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Overview · Administration" };

// X-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminPage() {
  return (
    <Screen id="X-01" frs="FR-103, FR-106" workspace="Administration" title="Overview" lead="Items needing attention.">
      <Blocks columns={2}>
        <Block label="Locked accounts" example={{ label: "Accounts", href: "/admin/accounts" }} />
        <Block label="Imports in progress" />
        <Block label="Scheduled configuration changes" />
        <Block label="Department credentials near expiry" />
      </Blocks>
    </Screen>
  );
}
