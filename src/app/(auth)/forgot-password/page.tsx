import { AuthScreen, Block, Form } from "@/components/skeleton/skeleton";

export const metadata = { title: "Reset your password" };

// G-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ForgotPasswordPage() {
  return (
    <AuthScreen id="G-02" frs="FR-101, FR-106" title="Reset your password">
      <Form
        fields={[{ label: "Email address", type: "email", help: "We will email a link to set a new password." }]}
        actions={["Send reset link", { label: "Back to sign in", href: "/sign-in", plain: true }]}
        bare
      />
      <Block label="Confirmation" detail="The same neutral message whether or not an account exists." size="sm" />
    </AuthScreen>
  );
}
