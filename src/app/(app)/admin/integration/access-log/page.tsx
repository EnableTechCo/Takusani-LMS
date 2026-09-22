import { Block, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "API access log · Administration" };

// X-08 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminIntegrationAccessLogPage() {
  return (
    <Screen
      id="X-08"
      frs="FR-110, FR-1006"
      workspace="Administration"
      title="API access log"
      lead="What the Department read."
      actions={["Export"]}
    >
      <Block label="Filters" detail="Time range, credential, route, status" size="sm" />
      <Block label="Access log" detail="Time, credential, route, status, record count, request ID" size="xl" />
    </Screen>
  );
}
