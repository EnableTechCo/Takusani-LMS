# ADR-009 Use edge and database-native caching and throttling controls

## Status

Proposed

## Context

The measured workload is modest, sensitive state must remain fresh, and operational simplicity is a priority.

## Decision

Use browser/HTTP/CDN controls, request memoisation, and bounded Next.js caching only for safe reference data. Use platform controls and atomic PostgreSQL time buckets for selective throttling.

## Alternatives considered

No caching at all; a new shared in-memory infrastructure tier.

## Positive consequences

Fewer components, strong freshness for academic state, and sufficient controls for calculated load.

## Negative consequences

PostgreSQL performs low-volume limiter writes; cacheable data options are intentionally narrow.

## Risks

Over-caching a role or result query would create a security or correctness defect.

## Revisit trigger

Add a dedicated shared caching or limiter service only after measured read load or cross-instance coordination exceeds database/platform headroom and a safe invalidation model exists.

