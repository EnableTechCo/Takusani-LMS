import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/link";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { PageHeader } from "@/components/shell/page-header";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { roleLabels } from "@/modules/identity/access";
import { unlockAccount } from "@/modules/identity/actions";

const UNLOCK_RESULTS: Record<string, { tone: "positive" | "info" | "critical"; title: string; body: string }> = {
  ok: {
    tone: "positive",
    title: "Account unlocked",
    body: "They can sign in again straight away, and they have been told.",
  },
  not_locked: {
    tone: "info",
    title: "That account was not locked",
    body: "Its lock may have ended by itself, or it was cleared by a password reset. Nothing was changed.",
  },
  forbidden: { tone: "critical", title: "Only an administrator can unlock an account", body: "Nothing was changed." },
  error: { tone: "critical", title: "The account could not be unlocked", body: "Try again." },
};

export const metadata = { title: "Accounts · Administration" };

// X-02 (FR-103, FR-106). Search, filters and account detail (X-03) come with the account administration ticket. An
// account whose new sign-ins are locked after wrong passwords shows until when, with Unlock.
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; unlock?: string }>;
}) {
  const { created, unlock } = await searchParams;
  const supabase = await createClient();
  const [{ data: accounts, error }, { data: locks, error: locksError }] = await Promise.all([
    supabase.rpc("list_accounts"),
    supabase.rpc("list_sign_in_locks"),
  ]);
  if (error) throw new Error(`api.list_accounts failed: ${error.message}`);
  if (locksError) throw new Error(`api.list_sign_in_locks failed: ${locksError.message}`);
  const lockedUntil = new Map((locks ?? []).map((lock) => [lock.profile_id, lock.locked_until]));
  const unlockResult = unlock ? (UNLOCK_RESULTS[unlock] ?? UNLOCK_RESULTS.error) : null;

  return (
    <div className="page">
      <PageHeader
        workspace="Administration"
        title="Accounts"
        lead="Everyone who can sign in, and the roles they hold."
      />
      <div className="stack stack--lg">
        {unlockResult ? (
          <Banner compact role="status" title={unlockResult.title} tone={unlockResult.tone}>
            <p>{unlockResult.body}</p>
          </Banner>
        ) : null}
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
              cell: (account) => {
                const until = lockedUntil.get(account.profile_id);
                return (
                  <div className="stack stack--sm">
                    {account.status === "active" ? <Tag tone="positive">Active</Tag> : <Tag>Deactivated</Tag>}
                    {until ? (
                      // FR-106, ADR-026: new sign-ins only; their existing session is not affected.
                      <>
                        <Tag shape="half" tone="caution">
                          Sign-in locked until {formatDateTime(until)}
                        </Tag>
                        <form action={unlockAccount.bind(null, account.profile_id)}>
                          <Button type="submit" variant="secondary">
                            Unlock {account.full_name}
                          </Button>
                        </form>
                      </>
                    ) : null}
                  </div>
                );
              },
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
