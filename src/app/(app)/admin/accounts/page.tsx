import { ButtonLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { roleLabels } from "@/modules/identity/access";

export const metadata = { title: "Accounts · Administration" };

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
          <ButtonLink href="/admin/accounts/new" variant="primary">
            New account
          </ButtonLink>
        </div>
        <DataTable
          caption="Accounts, by name. Times in SAST."
          columns={[
            { key: "name", header: "Name", primary: true, cell: (account) => account.full_name },
            { key: "email", header: "Email", cell: (account) => account.email },
            { key: "roles", header: "Roles", cell: (account) => roleLabels(account.roles).join(", ") || "None" },
            {
              key: "status",
              header: "Status",
              cell: (account) =>
                account.status === "active" ? <Tag tone="positive">Active</Tag> : <Tag>Deactivated</Tag>,
            },
            {
              key: "lastSignIn",
              header: "Last signed in",
              cell: (account) => (account.last_sign_in_at ? formatDateTime(account.last_sign_in_at) : "Not yet"),
            },
          ]}
          rowKey={(account) => account.profile_id}
          rows={accounts}
        />
      </div>
    </div>
  );
}
