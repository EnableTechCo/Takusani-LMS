# ADR-006 Use PostgreSQL functions for critical transactions

## Status

Proposed

## Context

Exam submission, assessment finalisation, moderation release, appeals, and credits must be all-or-nothing and safe under concurrency.

## Decision

Implement narrowly scoped functions that validate state/actor, lock rows, append immutable records, update current pointers, and insert audit/outbox entries in one transaction.

## Alternatives considered

Several client calls; application-managed transactions over a persistent direct connection for every command.

## Positive consequences

Atomicity close to data, consistent lock order, safe retry semantics, and a small auditable permission surface.

## Negative consequences

More SQL expertise and versioning/testing are required; long functions can create lock contention.

## Risks

Security-definer functions can be dangerous if grants or search paths are broad.

## Revisit trigger

Move orchestration outward only when a workflow spans truly independent systems and local transaction semantics are no longer possible.

