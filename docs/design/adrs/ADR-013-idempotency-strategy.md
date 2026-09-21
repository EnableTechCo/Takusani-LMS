# ADR-013 Use domain uniqueness first and idempotency records selectively

## Status

Proposed. Refined by the API design: one permanent client identifier per command; replay is semantically, not byte, equivalent.

## Context

Clients, cron events, queues, and providers retry. Duplicate academic side effects are unacceptable.

## Decision

Prefer permanent natural constraints such as one submission version, active attempt, source decision credit, or notification event. Use a 24-hour request-key table only where natural uniqueness cannot replay the original response.

## Alternatives considered

General table for every request; best-effort duplicate checks in application code.

## Positive consequences

Database-enforced safety, smaller dedupe state, and predictable retries.

## Negative consequences

Each command requires deliberate key and replay semantics.

## Risks

Expiring a key too soon can expose commands without permanent domain uniqueness.

## Revisit trigger

Extend retention or centralize handling when observed client retry windows or external contracts require it.

