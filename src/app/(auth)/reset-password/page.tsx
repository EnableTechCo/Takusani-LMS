import { AuthScreen, Form } from "@/components/skeleton/skeleton";

export const metadata = { title: "Set a new password" };

// G-02 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function ResetPasswordPage() {
  return (
    <AuthScreen id="G-02" frs="FR-101, FR-106" title="Set a new password">
      <Form
        fields={[
          { label: "New password", type: "password", help: "At least 12 characters." },
          { label: "Confirm new password", type: "password" },
        ]}
        actions={["Set new password"]}
        bare
      />
    </AuthScreen>
  );
}
