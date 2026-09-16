# ADR-012 Apply selective rate limiting

## Status

Proposed

## Context

Abuse-prone and expensive endpoints need protection, but global limits could disrupt synchronized exams.

## Decision

Limit by the narrowest stable principal and operation. Use Supabase controls for authentication, database-backed limits for Department and privileged commands, and attempt-aware cadence validation for exams.

## Alternatives considered

One global limit; no rate controls.

## Positive consequences

Protects credentials, cost, and expensive work without penalizing legitimate exam bursts.

## Negative consequences

More policies to tune and explain; database-backed counters add small write load.

## Risks

Bad defaults can block a cohort or fail to contain abuse.

## Revisit trigger

Tune from rejection and saturation metrics; replace an implementation only when its coordination/load ceiling is measured.

