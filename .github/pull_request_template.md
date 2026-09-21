## What and why

<!-- One or two sentences. Link the ClickUp ticket and the requirement (FR-xxx) or decision (ADR, P-xx) it serves. -->

## How it was tested

<!-- Commands run and what you checked by hand. Say plainly what was not tested. -->

## Database

- [ ] No database change in this PR

Or, for a database change:

- [ ] New migration created with `supabase migration new`; no existing migration was edited (CI enforces this)
- [ ] `npm run db:check` passes locally: reset, lint, tests, no schema drift, types up to date
- [ ] Grants to `anon` or `authenticated` are added to the allow-list in `supabase/tests/database/0002_privilege_allowlist.test.sql`
- [ ] Command functions follow `supabase/templates`: actor from `auth.uid()`, `search_path = ''`, typed result, audit row in the same transaction
- [ ] Append-only tables have both the revoke and the `audit.forbid_mutation()` triggers
- [ ] The current code on `main` keeps working against the new schema, because Vercel can deploy code a few minutes before the migration is applied (expand, then migrate, then contract)
- [ ] Destructive change (drop, rename, type change): the corrective-forward plan is written here
- [ ] Reviewed by the database owner

## Security and access

- [ ] No change to authentication, authorisation, secrets, RLS or deployment
- [ ] Or: the change is described above and the relevant ADR is linked
