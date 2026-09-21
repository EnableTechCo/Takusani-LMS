# ADR-024 Treat the Supabase Data API as a public surface: unexposed command schemas, actor from the session, audit in the database

## Status

Proposed. Refines ADR-004, ADR-005, and ADR-006.

## Context

Every browser holds the publishable key and the user's token, so it can call the Supabase Data API and its function endpoint directly, bypassing Route Handlers, application authorization, payload validation, and Route Handler rate limits. New functions are executable by `anon` and `authenticated` by default. RLS filters rows, not columns, so an answer key on a learner-readable table is readable. A function that accepts the actor as a parameter lets any signed-in user impersonate an assessor. Audit rows written by a second client call are not atomic with the change they describe.

## Decision

1. One SQL schema per module. Only a read-oriented `api` schema of views and thin wrappers is exposed to the Data API; tables and command functions live in unexposed module schemas. A module changes another module's data only by calling that module's published function.
2. User-initiated command functions run with the user's session. The actor is always `auth.uid()`; no function accepts an actor parameter. Worker functions are granted to `service_role` only.
3. Default execute privileges are revoked from `PUBLIC`, `anon`, and `authenticated`; each grant is explicit. `SECURITY DEFINER` functions set an empty `search_path` and qualify every name.
4. Invariants, state transitions, and their authorization predicates live in SQL. The predicates are written once as helper functions and used by RLS policies, by command functions, and by the application's user-facing check. Validation, orchestration, and presentation live in TypeScript.
5. Cadence and rate limits that protect the database are enforced inside the function, not only in the Route Handler.
6. Answer keys and automatic-feedback rules live in tables with no learner policy. Scores are computed by functions; learners have no write path to a score.
7. Audited tables are written only through functions that append the audit event in the same transaction, or carry an audit trigger. There are no audited "simple writes".
8. Append-only tables are protected by both privilege revocation, including from `service_role`, and `BEFORE UPDATE OR DELETE` and `BEFORE TRUNCATE` triggers that raise.
9. Function signatures change additively or by versioned name, so an application rollback never calls a missing signature.
10. A database test harness (pgTAP or equivalent) and a CI check that enumerates table and function privileges for `anon` and `authenticated` are deliverables that precede the first workflow function.

## Alternatives considered

Route Handlers as the only caller using the service role with an actor parameter; disabling the Data API entirely; TypeScript-managed transactions over the pooler.

## Positive consequences

A faulty or bypassed route cannot break an invariant; the actor cannot be forged; module boundaries exist in the database where the rules are; audit is atomic.

## Negative consequences

More SQL, a schema-per-module migration discipline, and a privilege regime to maintain and test.

## Risks

A grant or exposed schema added by mistake. Mitigated by the CI privilege enumeration failing the build on any unexpected grant.

## Revisit trigger

The privilege check finds an unexpected grant in production, or the team measurably cannot maintain the SQL layer, judged by defect rate in workflow functions over two release cycles.
