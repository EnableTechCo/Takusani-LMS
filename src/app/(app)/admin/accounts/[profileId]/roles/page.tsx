import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/page-header";
import { ConflictPanel } from "@/components/ui/conflict";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { TextLink } from "@/components/ui/link";
import { Log } from "@/components/ui/records";
import { Banner, Tag } from "@/components/ui/status";
import { DataTable } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { endRole } from "@/modules/identity/roles-actions";
import { AddRoleForm } from "@/modules/identity/roles-forms";
import { getAccount, getAccountRoles } from "@/modules/identity/roles-queries";
import { historySentence, isRefusal, itemsText, ROLE_REFUSALS, roleLabel } from "@/modules/identity/roles-rules";

export const metadata = { title: "Roles and allocations · Administration" };

// X-04 (FR-102, FR-104, FR-105, FR-107; U-01): one person's roles, the work with them now, adding and ending roles,
// and every change with its previous value.
export default async function AccountRolesPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ end?: string; assignment?: string }>;
}) {
  const [{ profileId }, flash] = await Promise.all([params, searchParams]);
  const account = await getAccount(profileId);
  if (!account) notFound();
  const { assignments, allocations, history, scopes } = await getAccountRoles(profileId);

  const ended = assignments.find((assignment) => assignment.id === flash.assignment);
  const endedText = ended ? `${roleLabel(ended.role)}, ${ended.scope_label}` : "The role";
  const marking = allocations.filter((allocation) => allocation.kind === "marking");

  return (
    <div className="page">
      <PageHeader
        lead="A role says what a person may be given. It does not give them any piece of work. Separation of duties is checked for each item when work is allocated."
        meta={
          <>
            {account.status === "active" ? (
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
            {account.learner_number ? <span className="mono">{account.learner_number}</span> : null}
          </>
        }
        title={`${account.full_name}: roles and allocations`}
        workspace="Administration"
      />

      <div className="stack stack--lg">
        {flash.end === "ok" ? (
          <Banner compact role="status" title={`Role ended: ${endedText}`} tone="positive">
            <p>{account.full_name} has been told. The change is in the history, with the previous value.</p>
          </Banner>
        ) : null}
        {flash.end === "open_allocations" ? (
          <ConflictPanel
            evidence={[
              ...marking.map((allocation) => ({
                term: "To mark",
                detail: `${itemsText(allocation.items)} in ${allocation.cohort_name}${
                  allocation.oldest_at ? `, the oldest submitted ${formatDateTime(allocation.oldest_at)}` : ""
                }`,
              })),
              {
                term: "What to do",
                detail: "Reallocate the items, or wait until they are finished. Then end the role again.",
              },
            ]}
            rule="FR-105 · open_allocations"
            title="The role was not ended: this person still has open work"
          >
            <p>
              {account.full_name} still has work that depends on {endedText}. Ending it now would leave that work with
              no one able to finish it. Nothing was changed.
            </p>
          </ConflictPanel>
        ) : null}
        {flash.end && flash.end !== "ok" && flash.end !== "open_allocations" ? (
          <Banner compact title={ROLE_REFUSALS[flash.end] ?? ROLE_REFUSALS.error} tone="critical" />
        ) : null}

        <section aria-labelledby="roles-h" className="stack">
          <h2 className="text-heading" id="roles-h">
            Role assignments
          </h2>
          <DataTable
            caption={`Role assignments for ${account.full_name}, current first. Times in SAST.`}
            columns={[
              { key: "role", header: "Role", primary: true, cell: (row) => roleLabel(row.role) },
              { key: "scope", header: "Where it applies", cell: (row) => row.scope_label },
              { key: "from", header: "In force from", cell: (row) => formatDateTime(row.effective_from) },
              {
                key: "until",
                header: "Until",
                cell: (row) => (row.effective_until ? formatDateTime(row.effective_until) : "No end date"),
              },
              { key: "by", header: "Assigned by", cell: (row) => row.assigned_by_name ?? "Set up with the system" },
              {
                key: "status",
                header: "Status",
                cell: (row) => (
                  <>
                    {row.in_force ? (
                      <Tag shape="dot" tone="positive">
                        In force
                      </Tag>
                    ) : (
                      <Tag shape="square">Ended</Tag>
                    )}
                    {row.dependent_items > 0 ? (
                      <span className="table__secondary">
                        {row.dependent_items === 1
                          ? "1 open allocation depends on it"
                          : `${row.dependent_items} open allocations depend on it`}
                      </span>
                    ) : null}
                  </>
                ),
              },
              {
                key: "actions",
                header: "Actions",
                actions: true,
                cell: (row) =>
                  row.in_force ? (
                    <form action={endRole.bind(null, profileId, row.id)} id={`end-${row.id}`}>
                      <ConsequenceDialog
                        cancelLabel="Keep the role"
                        confirmLabel="End the role now"
                        consequence={`${account.full_name} will no longer hold ${roleLabel(row.role)}, ${row.scope_label}, from now. If open work depends on it, nothing changes and you are told what to reallocate.`}
                        form={`end-${row.id}`}
                        title={`End ${roleLabel(row.role)}, ${row.scope_label}?`}
                        trigger={{ label: `End ${roleLabel(row.role)}, ${row.scope_label}`, variant: "secondary" }}
                      >
                        <ul className="modal__list">
                          <li>The assignment is kept on record with its dates.</li>
                          <li>{account.full_name} is told.</li>
                        </ul>
                      </ConsequenceDialog>
                    </form>
                  ) : (
                    <span className="text-small text-muted">Kept on record</span>
                  ),
              },
            ]}
            rowKey={(row) => row.id}
            rows={assignments}
          />
        </section>

        <div className="page-layout">
          <div className="page-layout__main stack stack--lg">
            <section aria-labelledby="alloc-h" className="stack">
              <h2 className="text-heading" id="alloc-h">
                Open allocations
              </h2>
              <p className="text-small text-muted">
                Work that is with {account.full_name} now. A role cannot be ended while work depends on it.
              </p>
              {allocations.length === 0 ? (
                <p className="text-muted">Nothing is allocated to them at the moment.</p>
              ) : (
                <DataTable
                  caption={`Work currently allocated to ${account.full_name}. Times in SAST.`}
                  columns={[
                    {
                      key: "work",
                      header: "Work",
                      primary: true,
                      cell: (row) => (
                        <>
                          {row.kind === "marking" ? "Items to mark" : "Appeal reviews"}
                          {row.cohort_name ? <span className="table__secondary">{row.cohort_name}</span> : null}
                        </>
                      ),
                    },
                    {
                      key: "role",
                      header: "Depends on",
                      cell: (row) =>
                        row.kind === "marking"
                          ? `An assessor role covering ${row.cohort_name}`
                          : "Given for one appeal at a time",
                    },
                    { key: "items", header: "Items", numeric: true, cell: (row) => row.items },
                    {
                      key: "oldest",
                      header: "Since",
                      cell: (row) => (row.oldest_at ? formatDateTime(row.oldest_at) : "No date"),
                    },
                  ]}
                  rowKey={(row) => `${row.kind}-${row.cohort_name ?? ""}`}
                  rows={allocations}
                />
              )}
            </section>

            <section aria-labelledby="add-h" className="card">
              <div className="card__header">
                <h2 className="card__title" id="add-h">
                  Add a role
                </h2>
              </div>
              <div className="card__body">
                {account.status === "active" ? (
                  <AddRoleForm
                    personName={account.full_name}
                    profileId={profileId}
                    scopes={scopes.map((scope) => ({
                      value: `${scope.scope_type}|${scope.scope_key ?? ""}`,
                      label: scope.label,
                    }))}
                  />
                ) : (
                  <p className="text-muted">This account is deactivated, so it cannot be given a role.</p>
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
                label={`Changes to ${account.full_name}'s roles and account, newest first. Times in SAST.`}
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
