import { AuthScreen, Block, Form } from "@/components/skeleton/skeleton";

export const metadata = { title: "Accept your invitation" };

// G-03 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function AcceptInvitePage() {
  return (
    <AuthScreen id="G-03" frs="FR-103" title="Accept your invitation">
      <Block label="Your account" detail="Name, roles granted and programme" size="sm" />
      <Form
        fields={[
          { label: "Choose a password", type: "password", help: "At least 12 characters." },
          { label: "Confirm password", type: "password" },
        ]}
        actions={["Set password"]}
        bare
      />
    </AuthScreen>
  );
}
