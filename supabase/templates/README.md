# SQL templates

Copy these into a new migration. They encode ADR-024 (Data API exposure and actor identity), ADR-006 (functions own critical transitions) and the append-only rule in `docs/design/LMS-data-model.md`. Files here are not applied by `supabase db reset`; only `supabase/migrations` is.

## Rules every migration follows

- Tables and command functions live in their module's schema (`identity`, `assessment`, ...). Only read views and thin wrappers go in `api`, the one schema exposed to the Data API.
- Default privileges grant nothing to `anon` or `authenticated`. Every grant is written out, and every grant to those roles is added to the allow-list in `supabase/tests/database/0002_privilege_allowlist.test.sql` in the same pull request.
- A command function takes the actor from `auth.uid()`. No function accepts an actor or user id parameter for the caller.
- A `security definer` function sets `search_path = ''` and schema-qualifies every name.
- A function returns a typed result. It never raises after a terminal transition, because the error would roll the transition back.
- Locks are taken in the documented order: cohort moderation state, cycle, results (ascending id), learner-unit outcomes.
- Function signatures change additively or under a new name, so an application rollback never calls a missing signature.

## Command function

- [command-function.sql](command-function.sql)

## Append-only table

- [append-only-table.sql](append-only-table.sql)
