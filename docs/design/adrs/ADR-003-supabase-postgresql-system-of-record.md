# ADR-003 Use Supabase PostgreSQL as the system of record

## Status

Proposed

## Context

The domain is relational and requires joins, scoped permissions, immutable history, constraints, and atomic multi-row transitions.

## Decision

Keep authoritative workflow, exam, permission, decision, credit, notification, and audit state in Supabase PostgreSQL. Storage contains file bodies; the database retains their metadata and checksums.

## Alternatives considered

Document database; wide-column database; multiple operational datastores.

## Positive consequences

ACID transactions, foreign keys, constraints, RLS, rich reporting, and one operational source of truth.

## Negative consequences

The primary database is a central dependency and requires disciplined indexes, pooled connections, and restore testing.

## Risks

Poor queries or serverless connection bursts can create an avoidable bottleneck.

## Revisit trigger

Revisit only after measured workload exceeds managed vertical scaling and query/index optimization, or a new workload has fundamentally non-relational access patterns.

