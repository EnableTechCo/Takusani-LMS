import { PageHeader } from "@/components/shell/page-header";
import { TextLink } from "@/components/ui/link";
import { EmptyState, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { listConfiguration } from "@/modules/audit/configuration-queries";
import { fromText, valueText, type Choice } from "@/modules/audit/configuration-rules";
import {
  adminLead,
  importsInProgress,
  lockedAccounts,
  scheduledChanges,
} from "@/modules/identity/admin-overview-rules";
import { listImportBatches } from "@/modules/identity/import-queries";

export const metadata = { title: "Overview · Administration" };

const IMPORT_STATE: Record<string, string> = { validated: "Checked, not imported", importing: "Importing" };

// X-01 (FR-103, FR-106): items needing an administrator: accounts whose sign-in is paused, imports not finished,
// and configuration changes scheduled for later. The landing page for an administrator.
export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const [{ data: accounts, error }, { data: locks, error: locksError }, batches, configuration] = await Promise.all([
    supabase.rpc("list_accounts"),
    supabase.rpc("list_sign_in_locks"),
    listImportBatches(),
    listConfiguration(),
  ]);
  if (error) throw new Error(`api.list_accounts failed: ${error.message}`);
  if (locksError) throw new Error(`api.list_sign_in_locks failed: ${locksError.message}`);
  const now = new Date();
  const locked = lockedAccounts(locks ?? [], accounts ?? [], now);
  const imports = importsInProgress(batches);
  const scheduled = scheduledChanges(configuration.settings);
  const counts = { locked: locked.length, imports: imports.length, scheduled: scheduled.length };

  return (
    <div className="page">
      <PageHeader lead={adminLead(counts)} title="Overview" workspace="Administration" />
      <div className="stack stack--lg">
        <div className="grid grid--3" role="list">
          <div className="stat" role="listitem">
            <span className="stat__label">Locked accounts</span>
            <span className="stat__value">{counts.locked}</span>
            <span className="stat__meta">Sign-in paused after failed attempts</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Imports in progress</span>
            <span className="stat__value">{counts.imports}</span>
            <span className="stat__meta">Checked or importing</span>
          </div>
          <div className="stat" role="listitem">
            <span className="stat__label">Scheduled configuration changes</span>
            <span className="stat__value">{counts.scheduled}</span>
            <span className="stat__meta">Taking effect on a later date</span>
          </div>
        </div>

        <section aria-labelledby="locked-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="locked-h">
              Locked accounts
            </h2>
            <TextLink href="/admin/accounts">All accounts</TextLink>
          </div>
          {locked.length === 0 ? (
            <div className="card">
              <EmptyState icon="lock" title="No accounts are locked">
                <p>An account whose sign-in is paused after repeated failed attempts appears here until it unlocks.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Accounts whose sign-in is paused, most recent first. Times in SAST."
              columns={[
                {
                  key: "account",
                  header: "Account",
                  primary: true,
                  cell: (account) => (
                    <>
                      <TextLink href={`/admin/accounts/${account.profile_id}`}>{account.full_name}</TextLink>
                      {account.email ? <span className="table__secondary">{account.email}</span> : null}
                    </>
                  ),
                },
                { key: "since", header: "Locked (SAST)", cell: (account) => formatDateTime(account.locked_at) },
                { key: "until", header: "Unlocks (SAST)", cell: (account) => formatDateTime(account.locked_until) },
                { key: "failures", header: "Failed attempts", numeric: true, cell: (account) => account.failures },
              ]}
              rowKey={(account) => account.profile_id}
              rows={locked}
            />
          )}
        </section>

        <section aria-labelledby="imports-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="imports-h">
              Imports
            </h2>
            <TextLink href="/admin/imports">All imports</TextLink>
          </div>
          {imports.length === 0 ? (
            <div className="card">
              <EmptyState icon="users" title="No imports in progress">
                <p>An intake file that has been checked but not imported, or is importing now, appears here.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Intake files checked or importing, newest first. Times in SAST."
              columns={[
                {
                  key: "batch",
                  header: "File",
                  primary: true,
                  cell: (batch) => (
                    <>
                      <TextLink href={`/admin/imports/${batch.id}`}>{batch.file_name}</TextLink>
                      <span className="table__secondary">
                        {batch.reference} · {batch.cohort_name}
                      </span>
                    </>
                  ),
                },
                { key: "uploaded", header: "Uploaded (SAST)", cell: (batch) => formatDateTime(batch.created_at) },
                {
                  key: "rows",
                  header: "Rows",
                  cell: (batch) =>
                    `${batch.ready} ready, ${batch.problems} with problems, ${batch.imported} of ${batch.total} imported`,
                },
                {
                  key: "state",
                  header: "State",
                  cell: (batch) => <Tag tone="info">{IMPORT_STATE[batch.state] ?? batch.state}</Tag>,
                },
              ]}
              rowKey={(batch) => batch.id}
              rows={imports}
            />
          )}
        </section>

        <section aria-labelledby="scheduled-h" className="stack">
          <div className="section__header">
            <h2 className="text-heading" id="scheduled-h">
              Scheduled configuration changes
            </h2>
            <TextLink href="/admin/configuration">Configuration</TextLink>
          </div>
          {scheduled.length === 0 ? (
            <div className="card">
              <EmptyState icon="calendar" title="No changes scheduled">
                <p>A setting recorded to change on a later date appears here until it takes effect.</p>
              </EmptyState>
            </div>
          ) : (
            <DataTable
              caption="Settings with a change scheduled, soonest first."
              columns={[
                {
                  key: "setting",
                  header: "Setting",
                  primary: true,
                  cell: (setting) => (
                    <>
                      <TextLink href={`/admin/configuration/${setting.key}`}>{setting.label}</TextLink>
                      <span className="table__secondary">{setting.group_label}</span>
                    </>
                  ),
                },
                {
                  key: "change",
                  header: "Change",
                  cell: (setting) => {
                    const shape = { ...setting, choices: setting.choices as unknown as Choice[] | null };
                    return `${valueText(shape, setting.value)} to ${valueText(shape, setting.scheduled_value)}`;
                  },
                },
                { key: "from", header: "From", cell: (setting) => fromText(setting.scheduled_from) },
              ]}
              rowKey={(setting) => setting.key}
              rows={scheduled}
            />
          )}
        </section>
      </div>
    </div>
  );
}
