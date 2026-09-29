/**
 * Administration overview (X-01; FR-103, FR-106): items needing an administrator. Pure rules over the lists the
 * workspace already reads, so the page is only layout.
 */

export interface LockRow {
  profile_id: string;
  locked_at: string;
  locked_until: string;
  failures: number;
}

export interface LockedAccount extends LockRow {
  full_name: string;
  email: string | null;
}

/** Accounts whose sign-in is paused right now, with their names, the most recent lock first. */
export function lockedAccounts(
  locks: LockRow[],
  accounts: { profile_id: string; full_name: string; email: string }[],
  now: Date,
): LockedAccount[] {
  const byId = new Map(accounts.map((account) => [account.profile_id, account]));
  return locks
    .filter((lock) => new Date(lock.locked_until).getTime() > now.getTime())
    .map((lock) => {
      const account = byId.get(lock.profile_id);
      return { ...lock, full_name: account?.full_name ?? "Unknown account", email: account?.email ?? null };
    })
    .sort((a, b) => b.locked_at.localeCompare(a.locked_at));
}

export interface BatchRow {
  id: string;
  reference: string;
  file_name: string;
  cohort_name: string;
  state: string;
  created_at: string;
  total: number;
  ready: number;
  problems: number;
  imported: number;
}

/** Intake files checked but not imported, and imports under way, newest first. */
export function importsInProgress<B extends BatchRow>(batches: B[]): B[] {
  return batches
    .filter((batch) => batch.state === "validated" || batch.state === "importing")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface SettingRow {
  key: string;
  label: string;
  group_label: string;
  scheduled_from: string | null;
}

/** Settings with a change recorded for a later date, soonest first. */
export function scheduledChanges<S extends SettingRow>(settings: S[]): (S & { scheduled_from: string })[] {
  return settings
    .filter((setting): setting is S & { scheduled_from: string } => setting.scheduled_from !== null)
    .sort((a, b) => a.scheduled_from.localeCompare(b.scheduled_from));
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The one-line summary under the title, in words. */
export function adminLead(counts: { locked: number; imports: number; scheduled: number }): string {
  const parts: string[] = [];
  if (counts.locked > 0) parts.push(count(counts.locked, "account is locked", "accounts are locked"));
  if (counts.imports > 0) parts.push(count(counts.imports, "import is in progress", "imports are in progress"));
  if (counts.scheduled > 0) {
    parts.push(count(counts.scheduled, "configuration change is scheduled", "configuration changes are scheduled"));
  }
  if (parts.length === 0) return "Nothing needs your attention right now.";
  const sentence = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
