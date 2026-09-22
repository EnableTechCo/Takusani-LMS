import { NewPasswordForm } from "@/modules/identity/forms";

export const metadata = { title: "Choose a new password" };

// G-02. Reached from the reset email through /auth/confirm, which has signed the person in.
export default function ResetPasswordPage() {
  return (
    <div className="stack">
      <h1 className="text-title">Choose a new password</h1>
      <NewPasswordForm submitLabel="Save new password" />
    </div>
  );
}
