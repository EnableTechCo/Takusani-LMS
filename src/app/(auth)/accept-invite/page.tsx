import { redirect } from "next/navigation";
import { isRole, ROLE_LABELS } from "@/modules/identity/access";
import { NewPasswordForm } from "@/modules/identity/forms";
import { getMyAccess } from "@/modules/identity/session";

export const metadata = { title: "Set up your account" };

// G-03 (FR-103). Reached from the invitation email through /auth/confirm, which has signed the person in.
export default async function AcceptInvitePage() {
  const access = await getMyAccess();
  if (access?.status !== "active") redirect("/auth/sign-out?reason=no_access");
  const roles = access.roles.filter(isRole).map((role) => ROLE_LABELS[role]);

  return (
    <div className="stack">
      <h1 className="text-title">Set up your account</h1>
      <dl className="stack stack--sm">
        <div>
          <dt className="text-small text-muted">Name</dt>
          <dd>{access.full_name}</dd>
        </div>
        <div>
          <dt className="text-small text-muted">Email address</dt>
          <dd>{access.email}</dd>
        </div>
        <div>
          <dt className="text-small text-muted">{roles.length === 1 ? "Role" : "Roles"}</dt>
          <dd>{roles.join(", ") || "None yet"}</dd>
        </div>
      </dl>
      <p>Choose a password to finish setting up your account. You will use it with your email address to sign in.</p>
      <NewPasswordForm submitLabel="Set password and continue" />
    </div>
  );
}
