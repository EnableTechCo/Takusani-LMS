import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Audit log · Administration" };

// X-09 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminAuditPage() {
  return (
    <Screen
      id="X-09"
      frs="FR-107, NFR-02"
      workspace="Administration"
      title="Audit log"
      lead="Who changed what, and when."
    >
      <Block label="Filters" detail="Actor, action, object, time range" size="sm" />
      <Block
        label="Audit entries"
        detail="Actor, acting role and scope, action, object, before and after, time"
        size="xl"
      />
    </Screen>
  );
}
