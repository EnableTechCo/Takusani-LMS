import { Block, Blocks, Screen } from "@/components/skeleton/skeleton";

export const metadata = { title: "Import · Administration" };

// X-05 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AdminImportsBatchIdPage() {
  return (
    <Screen id="X-05" frs="FR-103" workspace="Administration" title="Import" actions={["Import valid rows"]}>
      <Blocks columns={3}>
        <Block label="Valid rows" size="sm" />
        <Block label="Invalid rows" size="sm" />
        <Block label="Duplicates" size="sm" />
      </Blocks>
      <Block heading="Error report" label="Invalid rows with reasons; download to fix and import again" size="lg" />
      <Block heading="Invitations" label="Invitation progress" size="sm" />
    </Screen>
  );
}
