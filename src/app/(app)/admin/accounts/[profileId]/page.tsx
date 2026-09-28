import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { ConflictPanel } from "@/components/ui/conflict";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { TextareaField } from "@/components/ui/field";
import { ButtonLink, TextLink } from "@/components/ui/link";
import { Log } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { formatDateTime } from "@/lib/dates";
import { deactivateAccount, reactivateAccount, sendPasswordReset } from "@/modules/identity/account-actions";
import { AccountDetailsForm } from "@/modules/identity/account-forms";
import { unlockAccount } from "@/modules/identity/actions";
import { getAccount, getAccountRoles } from "@/modules/identity/roles-queries";
import { historySentence, isRefusal, itemsText } from "@/modules/identity/roles-rules";

export const metadata = { title: "Account · Administration" };

const STATUS_RESULTS: Record<string, { tone: "positive" | "info" | "critical"; title: string; body: string }> = {
  ok: {
    tone: "positive",
    title: "Account deactivated",
    body: "They can no longer sign in, and any session they had open has ended. Their records are kept.",
  },
  reactivated: { tone: "positive", title: "Account reactivated", body: "They can sign in again, and have been told." },
  already_deactivated: { tone: "info", title: "The account was already deactivated", body: "Nothing was changed." },
  already_active: { tone: "info", title: "The account was already active", body: "Nothing was changed." },
  cannot_deactivate_self: {
    tone: "critical",
    title: "You cannot deactivate your own account",
    body: "Ask another administrator. Nothing was changed.",
  },
  forbidden: { tone: "critical", title: "Only an administrator can do that", body: "Nothing was changed." },
  error: { tone: "critical", title: "That could not be done", body: "Try again." },
};

const RESET_RESULTS: Record<string, { tone: "positive" | "critical"; title: string; body: string }> = {
  ok: {
    tone: "positive",
    title: "Password reset link sent",
    body: "The link works once and expires in one hour. They have been told in the LMS too.",
  },
  not_sent: {
    tone: "critical",
    title: "The reset was recorded but the email could not be sent",
    body: "Check the email settings (docs/development/README.md), then try again.",
  },
  deactivated: { tone: "critical", title: "A deactivated account cannot be reset", body: "Reactivate it first." },
  error: { tone: "critical", title: "The reset link could not be sent", body: "Try again." },
};

const UNLOCK_RESULTS: Record<string, { tone: "positive" | "info" | "critical"; title: string }> = {
  ok: { tone: "positive", title: "Sign-in unlocked. They can sign in again, and have been told." },
  not_locked: { tone: "info", title: "Sign-in was not locked. Nothing was changed." },
  error: { tone: "critical", title: "Sign-in could not be unlocked. Try again." },
};

// X-03 (FR-103, FR-105, FR-106, FR-107): one account: its details, sign-in, and whether it is active, with every
// change and the previous value. Roles and allocations are on their own page (X-04).
export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ status?: string; reset?: string; unlock?: string }>;
}) {
  const [{ profileId }, flash] = await Promise.all([params, searchParams]);
  const account = await getAccount(profileId);
  if (!account) notFound();
  const { allocations, history } = await getAccountRoles(profileId);
  const active = account.status === "active";
  const statusResult =
    flash.status && flash.status !== "open_allocations" ? (STATUS_RESULTS[flash.status] ?? STATUS_RESULTS.error) : null;
  const resetResult = flash.reset ? (RESET_RESULTS[flash.reset] ?? RESET_RESULTS.error) : null;
  const unlockResult = flash.unlock ? (UNLOCK_RESULTS[flash.unlock] ?? UNLOCK_RESULTS.error) : null;

  return (
    <div className="page">
      <PageHeader
        actions={
          <ButtonLink href={`/admin/accounts/${profileId}/roles`} variant="secondary">
            Roles and allocations
          </ButtonLink>
        }
        meta={
          <>
            {active ? (
              <Tag shape="dot" tone="positive">
                Active
              </Tag>
            ) : (
              <Tag>Deactivated</Tag>
            )}
            {account.locked_until ? (
              <Tag shape="half" tone="caution">
                Sign-in locked until {formatDateTime(account.locked_until)}
              </Tag>
            ) : null}
            <span>{account.email}</span>
          </>
        }
        title={account.full_name}
        workspace="Administration"
      />
      <div className="stack stack--lg">
        {statusResult ? (
          <Banner compact role="status" title={statusResult.title} tone={statusResult.tone}>
            <p>{statusResult.body}</p>
          </Banner>
        ) : null}
        {flash.status === "open_allocations" ? (
          <ConflictPanel
            actions={
              <ButtonLink href={`/admin/accounts/${profileId}/roles`} variant="primary">
                Go to open allocations
              </ButtonLink>
            }
            evidence={[
              ...allocations.map((allocation) => ({
                term: allocation.kind === "marking" ? `Marking, ${allocation.cohort_name}` : "Appeal reviews",
                detail: itemsText(allocation.items),
              })),
              {
                term: "What to do",
                detail: "Reallocate all of it. When nothing is left, deactivate the account again.",
              },
            ]}
            rule="FR-105 · open_allocations"
            title="The account was not deactivated: this person still has open work"
          >
            <p>
              {account.full_name} still has work allocated to them. Deactivating the account now would leave it with no
              one. Nothing was changed, and they can still sign in.
            </p>
          </ConflictPanel>
        ) : null}
        {resetResult ? (
          <Banner compact role="status" title={resetResult.title} tone={resetResult.tone}>
            <p>{resetResult.body}</p>
          </Banner>
        ) : null}
        {unlockResult ? <Banner compact role="status" title={unlockResult.title} tone={unlockResult.tone} /> : null}

        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            <section aria-labelledby="details-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="details-h">
                  Details
                </h2>
              </div>
              <div className="card__body stack">
                <AccountDetailsForm
                  fullName={account.full_name}
                  learnerNumber={account.learner_number ?? null}
                  profileId={profileId}
                />
                <p className="text-small text-muted">
                  The email address, {account.email}, is how they sign in. It is not changed here.
                </p>
              </div>
            </section>

            <section aria-labelledby="signin-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="signin-h">
                  Sign-in
                </h2>
              </div>
              <div className="card__body stack">
                {account.locked_until ? (
                  <div className="stack stack--sm">
                    <p>
                      New sign-ins are locked until {formatDateTime(account.locked_until)} after repeated wrong
                      passwords. A session they already have is not affected.
                    </p>
                    <form action={unlockAccount.bind(null, profileId, "account")}>
                      <Button type="submit" variant="secondary">
                        Unlock {account.full_name}
                      </Button>
                    </form>
                  </div>
                ) : null}
                {active ? (
                  <form action={sendPasswordReset.bind(null, profileId)} id="reset-form">
                    <ConsequenceDialog
                      cancelLabel="Go back"
                      confirmLabel="Send the link"
                      consequence={`${account.full_name} gets an email with a link to choose a new password. Their current password keeps working until they use it.`}
                      form="reset-form"
                      title={`Send a password reset link to ${account.email}?`}
                      trigger={{ label: "Send a password reset link", variant: "secondary" }}
                    >
                      <ul className="modal__list">
                        <li>The link works once and expires in one hour.</li>
                        <li>It is recorded, and they are told in the LMS.</li>
                      </ul>
                    </ConsequenceDialog>
                  </form>
                ) : (
                  <p className="text-muted">A deactivated account cannot sign in.</p>
                )}
              </div>
            </section>

            <section aria-labelledby="status-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="status-h">
                  {active ? "Deactivate the account" : "Reactivate the account"}
                </h2>
              </div>
              <div className="card__body stack">
                {active ? (
                  <form action={deactivateAccount.bind(null, profileId)} className="stack" id="deactivate-form">
                    <p className="text-small">
                      Deactivating ends any session they have open straight away and stops them signing in. Their
                      records are kept. It is refused while work is still allocated to them.
                    </p>
                    <TextareaField help="Kept in the change history." label="Reason" name="reason" optional rows={2} />
                    <div>
                      <ConsequenceDialog
                        cancelLabel="Keep the account active"
                        confirmLabel="Deactivate the account"
                        consequence={`${account.full_name} will be signed out everywhere at once and will not be able to sign in. Their records are kept, and you can reactivate the account later.`}
                        form="deactivate-form"
                        title={`Deactivate ${account.full_name}?`}
                        trigger={{ label: "Deactivate the account", variant: "secondary" }}
                      >
                        <ul className="modal__list">
                          <li>
                            If work is still allocated to them, nothing changes and you are told what to reallocate.
                          </li>
                          <li>You are acting as an administrator.</li>
                        </ul>
                      </ConsequenceDialog>
                    </div>
                  </form>
                ) : (
                  <form action={reactivateAccount.bind(null, profileId)} id="reactivate-form">
                    <ConsequenceDialog
                      cancelLabel="Keep it deactivated"
                      confirmLabel="Reactivate the account"
                      consequence={`${account.full_name} will be able to sign in again, with the roles they held.`}
                      form="reactivate-form"
                      title={`Reactivate ${account.full_name}?`}
                      trigger={{ label: "Reactivate the account", variant: "secondary" }}
                    />
                  </form>
                )}
              </div>
            </section>
          </div>

          <aside aria-labelledby="hist-h" className="page-layout__aside stack">
            <h2 className="text-subheading" id="hist-h">
              Change history
            </h2>
            {history.length === 0 ? (
              <p className="text-small text-muted">No changes recorded yet.</p>
            ) : (
              <Log
                boxed
                entries={history.map((entry) => ({
                  id: String(entry.id),
                  at: entry.occurred_at,
                  actor: entry.actor_name ?? "The system",
                  event: historySentence({
                    action: entry.action,
                    before: entry.before as Record<string, unknown> | null,
                    after: entry.after as Record<string, unknown> | null,
                    details: entry.details as Record<string, unknown> | null,
                  }),
                  marked: isRefusal(entry.action),
                }))}
                label={`Changes to ${account.full_name}'s account and roles, newest first. Times in SAST.`}
              />
            )}
            <p>
              <TextLink href="/admin/accounts">All accounts</TextLink>
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
