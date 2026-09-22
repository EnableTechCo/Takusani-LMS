import { ForgotPasswordForm } from "@/modules/identity/forms";

export const metadata = { title: "Reset your password" };

// G-02 (FR-101, FR-106). The reply never reveals whether an account exists.
export default function ForgotPasswordPage() {
  return (
    <div className="stack">
      <h1 className="text-title">Reset your password</h1>
      <ForgotPasswordForm />
    </div>
  );
}
