import { AuthScreen, Block, Form } from "@/components/skeleton/skeleton";

export const metadata = { title: "Sign in" };

// G-01 skeleton (docs/design/ui/LMS-ux-architecture.md, section 5.1). Replace blocks as the feature is built.
export default function SignInPage() {
  return (
    <AuthScreen id="G-01" frs="FR-101, FR-106" title="Sign in">
      <Block
        label="Message, when needed"
        detail="Wrong details (one neutral message), sign-in paused after too many attempts, or “You were signed out for security”."
        size="sm"
      />
      <Form
        fields={[
          { label: "Email address", type: "email" },
          { label: "Password", type: "password" },
          { label: "Show password", type: "checkbox" },
        ]}
        actions={["Sign in", { label: "Forgot your password?", href: "/forgot-password", plain: true }]}
        bare
      />
    </AuthScreen>
  );
}
