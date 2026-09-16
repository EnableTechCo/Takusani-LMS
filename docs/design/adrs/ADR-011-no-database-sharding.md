# ADR-011 Do not shard the database

## Status

Proposed

## Context

Peak exam writes are approximately 30 per second in the sensitivity case and projected data remains within one managed PostgreSQL system.

## Decision

Use one logical database with appropriate compute, pooled connections, indexes, pagination, archiving, and optional table partitioning for append-heavy history only when measured.

## Alternatives considered

Application-level shards; database-per-module; early distributed SQL.

## Positive consequences

Preserves joins, transactions, constraints, simple reporting, and operations.

## Negative consequences

The primary database remains the main scaling boundary.

## Risks

Unbounded retention or bad queries can be mistaken for a need to shard.

## Revisit trigger

Revisit only after optimized queries, archival, compute scaling, and workload isolation cannot meet SLOs and the write/data limit is measured.

