import { PageHeader } from "@/components/shell/page-header";
import { NewAccountForm } from "@/modules/identity/forms";

export const metadata = { title: "New account · Administration" };

// X-02 New account (FR-103): creates the account with one role and emails an invitation.
export default function NewAccountPage() {
  return (
    <div className="page page--form">
      <PageHeader
        workspace="Administration"
        title="New account"
        lead="Create an account and send the person an invitation to choose their password."
      />
      <div className="card">
        <div className="card__body">
          <NewAccountForm />
        </div>
      </div>
    </div>
  );
}
