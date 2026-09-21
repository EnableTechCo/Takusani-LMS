# ADR-005 Use application authorization plus RLS

## Status

Proposed. Refined by ADR-024 (authorization predicates written once in SQL).

## Context

Users may hold multiple roles scoped differently. A single missed application check could expose academic or personal records.

## Decision

Application services perform capability checks and produce user-facing denials; RLS independently restricts rows and Storage objects. Critical functions re-check actor, scope, and separation rules inside the transaction.

## Alternatives considered

Application authorization only; RLS only.

## Positive consequences

Defence in depth, safe direct scoped reads, explicit domain errors, and reduced impact of a route bug.

## Negative consequences

Policies and application logic must remain aligned and require a substantial matrix test suite.

## Risks

Privileged server paths can bypass RLS if they fail to call a validating function.

## Revisit trigger

Never remove one layer for sensitive data; simplify only for tables proven public or server-internal with explicit grants.

