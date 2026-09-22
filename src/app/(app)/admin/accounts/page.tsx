import Link from "next/link";
import { Banner } from "@/components/forms/form-parts";
import { PageHeader } from "@/components/shell/page-header";
import { createClient } from "@/lib/supabase/server";
import { roleLabels } from "@/modules/identity/access";

export const metadata = { title: "Accounts · Administration" };

const DATE = new Intl.DateTimeFormat("en-ZA", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Johannesburg",
});

// X-02 (FR-103). Search, filters and account detail (X-03) come with the account administration ticket.
export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ created?: string }> }) {
  const { created } = await searchParams;
  const supabase = await createClient();
  const { data: accounts, error } = await supabase.rpc("list_accounts");
  if (error) throw new Error(`api.list_accounts failed: ${error.message}`);

  return (
    <div className="page">
      <PageHeader
        workspace="Administration"
        title="Accounts"
        lead="Everyone who can sign in, and the roles they hold."
      />
      <div className="stack stack--lg">
        {created ? (
          <Banner title="Account created" tone="positive">
            <p>An invitation has been sent to {created}. They choose their own password from the email.</p>
          </Banner>
        ) : null}
        <div className="cluster">
          <Link className="btn btn--primary" href="/admin/accounts/new">
            New account
          </Link>
        </div>
        <div className="table-wrap">
          <table className="table table--cards">
            <caption className="u-visually-hidden">Accounts, by name. Times in SAST.</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Email</th>
                <th scope="col">Roles</th>
                <th scope="col">Status</th>
                <th scope="col">Last signed in</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.profile_id}>
                  <th className="table__primary-cell" data-label="Name" scope="row">
                    {account.full_name}
                  </th>
                  <td data-label="Email">{account.email}</td>
                  <td data-label="Roles">{roleLabels(account.roles).join(", ") || "None"}</td>
                  <td data-label="Status">
                    <span className={account.status === "active" ? "tag tag--positive" : "tag"}>
                      {account.status === "active" ? "Active" : "Deactivated"}
                    </span>
                  </td>
                  <td data-label="Last signed in">
                    {account.last_sign_in_at ? DATE.format(new Date(account.last_sign_in_at)) : "Not yet"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
