# ADR-028 Do not use Supabase's automatic RLS event trigger

## Status

Accepted, 22 September 2026 (S1-17). Refines ADR-024.

## Context

The staging project was created with Supabase's option to enable row level security on new tables. The option installs an event trigger, `ensure_rls`, that runs `public.rls_auto_enable()` after `CREATE TABLE`, `CREATE TABLE AS` and `SELECT INTO`. Neither is in our migrations, so the local and CI databases do not have them and staging differs from both.

Inspection of staging on 22 September 2026 found:

- The function enables RLS only on tables created in `public`. Every other schema is skipped by design.
- `public` holds none of our tables. Domain tables live in module schemas (`identity`, `audit`, `programmes`, and later others), and all twelve of them have RLS off, because the trigger never acted on them.
- The function is `SECURITY DEFINER` and executable by `anon` and `authenticated`, since it was created before our default-privilege hardening. It cannot be called through the Data API because `public` is not exposed.

ADR-024 already makes the Data API the boundary. Only the `api` schema is exposed. Module schemas are unreachable whatever their grants, and a function in `api` runs only after an explicit grant that the privilege allow-list test must list. Spike X-1 confirmed this (design register, section 5), and `scripts/check-data-api-exposure.mjs` keeps checking it in CI.

## Decision

1. Remove the trigger and its function from every environment with a migration (`20260924090000_remove_auto_rls_event_trigger.sql`), so local, CI and staging match and production is never created with them.
2. Do not replace it. A table is protected by where it lives, not by RLS being switched on after the fact: domain tables go in their module schema and are reached through `api` functions.
3. Keep `public` empty. `supabase/tests/database/0008_public_schema_empty.test.sql` fails if a table, view or function of ours appears there, or if the trigger returns.
4. RLS is still used where ADR-005 calls for it, as a deliberate policy per table. It is not a blanket setting.
5. When creating the production project, leave the automatic RLS option unticked. If it is ticked by mistake, this migration removes it on the first deploy.

## Alternatives considered

- **Keep it and write it into a migration.** This would make the environments match, but it protects only `public`, which we do not use. It would also leave a security-definer function callable by `anon` in the database.
- **Extend it to the module schemas.** Blanket RLS with no policies would make every module table unreadable to the definer-rights functions' callers in ways that are hard to see. Where RLS is wanted, it should be a written policy, not a side effect of `CREATE TABLE`.

## Positive consequences

- Local, CI and staging databases are built from the same migrations, and the drift check means what it says.
- One fewer security-definer function is exposed to `anon`.
- The rule about where tables go is enforced by a test rather than by a trigger that did not apply to them.

## Negative consequences

A table created by hand in `public` on a hosted project would no longer get RLS automatically. The pgTAP test only sees databases built from migrations, so such a table would be found by the Supabase security advisor or by the next drift review, not by CI.

## Revisit trigger

Revisit if any schema other than `api` is ever exposed through the Data API, or if a table must be placed in `public`.
